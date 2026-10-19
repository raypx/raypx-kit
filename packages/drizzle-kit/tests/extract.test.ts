import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { satisfies, subset, validRange } from "semver";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { extract, readUpstream, upstreamDirectory } from "../src/extract.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = join(root, "tests/fixtures/schema");
const upstream = upstreamDirectory(root);
let temporary: string;
let output: string;
let files: string[];

beforeAll(async () => {
  // Inside the package, so the extracted CLI resolves its dependencies like an install.
  await mkdir(join(root, "node_modules/.cache"), { recursive: true });
  temporary = await mkdtemp(join(root, "node_modules/.cache/extract-"));
  await writeFile(join(temporary, "package.json"), await readFile(join(root, "package.json")));
  output = join(temporary, "dist");
  files = await extract(root, output);
});
afterAll(() => rm(temporary, { recursive: true, force: true }));

async function size(directory: string, names: string[]) {
  let total = 0;
  for (const name of names) total += (await stat(join(directory, name))).size;
  return total;
}

/** Runs `generate` and returns the SQL it wrote, without timestamped folder names. */
async function generate(bin: string): Promise<string[]> {
  const out = await mkdtemp(join(temporary, "out-"));
  execFileSync(process.execPath, [bin, "generate", "--config", "drizzle.config.ts"], {
    cwd: fixture,
    env: { ...process.env, DRIZZLE_OUT: out },
    stdio: "pipe",
  });
  const sql: string[] = [];
  for (const entry of await readdir(out, { recursive: true }))
    if (entry.endsWith(".sql")) sql.push(await readFile(join(out, entry), "utf8"));
  return sql;
}

// Several cases start the 7 MB CLI bundle, which is slow while Turbo runs other suites.
describe("extracted drizzle-kit", { timeout: 60_000 }, () => {
  it("keeps the CLI, defineConfig and their declaration chunks only", () => {
    expect(files).toContain("bin.cjs");
    for (const entry of ["index.js", "index.mjs", "index.d.ts", "index.d.mts"])
      expect(files).toContain(entry);
    expect(files.filter((file) => /^(api|payload|cli)[-.]/.test(file))).toEqual([]);
    expect(files.every((file) => !file.endsWith(".d.ts") || !file.includes("/"))).toBe(true);
  });

  it("copies upstream bytes unchanged", async () => {
    const digest = async (file: string) =>
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex");
    for (const file of files)
      expect(await digest(join(output, file))).toBe(await digest(join(upstream, file)));
  });

  it("loads defineConfig through CommonJS and ESM exports", async () => {
    expect(JSON.parse(await readFile(join(output, "package.json"), "utf8"))).toEqual({
      type: "commonjs",
    });
    // The archive consumer gate also checks both export conditions with Node.
    execFileSync(
      process.env.TOOLKIT_NODE_BINARY ?? process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const commonjs = require("@raypx-kit/drizzle-kit");
const esm = await import("@raypx-kit/drizzle-kit");
const config = { dialect: "postgresql", schema: "./schema.ts" };
assert.equal(commonjs.defineConfig(config), config);
assert.equal(esm.defineConfig(config), config);`,
      ],
      { cwd: temporary, stdio: "pipe" },
    );
  });

  it("keeps the agent skills the CLI serves", async () => {
    const list = async (directory: string) =>
      (await readdir(directory, { recursive: true })).sort();
    expect(await list(join(output, "skills"))).toEqual(await list(join(upstream, "skills")));
    const help = execFileSync(process.execPath, [join(output, "bin.cjs"), "skills", "--help"], {
      cwd: fixture,
      encoding: "utf8",
    });
    expect(help).toContain("skills");
  });

  it("is a fraction of the upstream package", async () => {
    const all = (await readdir(upstream, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    expect(await size(output, files)).toBeLessThan((await size(upstream, all)) / 5);
  });

  it("covers upstream dependencies and keeps the ORM and CLI versions synchronized", async () => {
    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      bin: Record<string, string>;
    };
    const kit = await readUpstream(upstream);
    const consumer = JSON.parse(
      await readFile(join(root, "tests/fixtures/consumer/package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    const extensions = JSON.parse(
      await readFile(join(root, "../drizzle/package.json"), "utf8"),
    ) as {
      devDependencies: Record<string, string>;
      peerDependencies: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies).sort()).toEqual(Object.keys(kit.dependencies).sort());
    for (const [name, upstreamRange] of Object.entries(kit.dependencies)) {
      const declaredRange = manifest.dependencies[name]!;
      expect(validRange(upstreamRange), name).not.toBeNull();
      expect(validRange(declaredRange), name).not.toBeNull();
      expect(subset(upstreamRange, declaredRange), name).toBe(true);
    }
    expect(Object.keys(manifest.bin)).toEqual(Object.keys(kit.bin));
    const range = manifest.devDependencies["drizzle-kit"]!;
    expect(validRange(range)).not.toBeNull();
    expect(manifest.devDependencies["drizzle-orm"]).toBe(range);
    expect(consumer.dependencies["drizzle-orm"]).toBe(range);
    expect(extensions.devDependencies["drizzle-orm"]).toBe(range);
    expect(extensions.peerDependencies["drizzle-orm"]).toBe(range);
    expect(satisfies(kit.version, range)).toBe(true);

    const require = createRequire(join(root, "package.json"));
    const orm = JSON.parse(await readFile(require.resolve("drizzle-orm/package.json"), "utf8")) as {
      version: string;
    };
    expect(orm.version).toBe(kit.version);
  });

  it("generates the same migration as upstream", async () => {
    const slim = await generate(join(output, "bin.cjs"));
    expect(slim).toHaveLength(1);
    expect(slim[0]).toContain('CREATE TABLE "app"."users"');
    expect(slim).toEqual(await generate(join(upstream, "bin.cjs")));
  });

  it("reports the same versions as upstream", () => {
    const version = (directory: string) =>
      execFileSync(process.execPath, [join(directory, "bin.cjs"), "--version"], {
        cwd: fixture,
        encoding: "utf8",
      });
    expect(version(output)).toContain("drizzle-kit: v1.0.0");
    expect(version(output)).toBe(version(upstream));
  });
});

describe("Drizzle RC5 compatibility range", () => {
  it.each([
    ["1.0.0-rc.5-5935859", true],
    ["1.0.0-rc.5-ab785fc", true],
    ["1.0.0-rc.4", false],
    ["1.0.0-rc.4-fffffff", false],
    ["1.0.0-rc.6", false],
    ["1.0.0-rc.6-0000000", false],
    ["1.0.0-rc.50-0000000", false],
    ["1.0.0", false],
    ["1.0.1", false],
    ["1.1.0", false],
  ])("acceptance of %s is %s", async (version, supported) => {
    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      devDependencies: Record<string, string>;
    };
    expect(satisfies(version, manifest.devDependencies["drizzle-kit"]!)).toBe(supported);
  });
});
