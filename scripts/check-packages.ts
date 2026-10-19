import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertToolchainRuntime } from "./toolchain.js";

type Dependencies = Record<string, string>;

interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  files?: string[];
  exports: Record<string, unknown>;
  bin?: string | Record<string, string>;
  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  optionalDependencies?: Dependencies;
  peerDependencies?: Dependencies;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

interface PlanEntry {
  kind: string;
  name: string;
  tarball: { path: string };
}

const root = fileURLToPath(new URL("../", import.meta.url));
const { nodeBinary: node } = assertToolchainRuntime(root);
const rootManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as Manifest;
const temporary = await mkdtemp(join(tmpdir(), "raypx-kit-pack-"));
// Release packing checks the exact archives it will publish instead of packing again.
const releasePlan = process.env.TOOLKIT_RELEASE_PLAN;
const releaseArchives = releasePlan
  ? new Map(
      (JSON.parse(await readFile(releasePlan, "utf8")) as { plan: PlanEntry[][] }).plan
        .flat()
        .filter((entry) => entry.kind === "publish")
        .map((entry) => [entry.name, resolve(dirname(releasePlan), entry.tarball.path)]),
    )
  : undefined;

function run(binary: string, args: string[], cwd: string): string {
  return execFileSync(binary, args, { cwd, encoding: "utf8", stdio: "pipe" });
}

function readArchived(archive: string, path: string): string {
  return execFileSync("tar", ["-xOf", archive, `package/${path}`], { encoding: "utf8" });
}

function exportTargets(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(exportTargets);
  if (value && typeof value === "object") return Object.values(value).flatMap(exportTargets);
  return [];
}

function hasRequireCondition(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Object.hasOwn(value, "require")) return true;
  return Object.values(value).some(hasRequireCondition);
}

function binaryEntries(manifest: Manifest): [string, string][] {
  if (typeof manifest.bin === "string") return [[manifest.name.split("/").at(-1)!, manifest.bin]];
  return Object.entries(manifest.bin ?? {});
}

/** Rules every public archive follows; package behavior belongs in unit tests. */
async function assertArchive(
  archive: string,
  manifest: Manifest,
  packageDirectory: string,
): Promise<Manifest> {
  const entries = new Set(run("tar", ["-tzf", archive], temporary).trim().split("\n"));
  const packed = JSON.parse(readArchived(archive, "package.json")) as Manifest;
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  assert.deepEqual(
    packed.peerDependenciesMeta,
    manifest.peerDependenciesMeta,
    `${packed.name}: peer dependency metadata changed in the archive`,
  );
  for (const file of ["LICENSE", "README.md"])
    assert.ok(entries.has(`package/${file}`), `${packed.name}: missing ${file}`);
  for (const directory of ["node_modules", "third-party"])
    assert.ok(![...entries].some((entry) => entry.startsWith(`package/${directory}/`)));
  if (manifest.files?.includes("NOTICE.md")) {
    for (const file of ["NOTICE.md", "LICENSE"])
      assert.equal(
        readArchived(archive, file),
        await readFile(join(packageDirectory, file), "utf8"),
        `${packed.name}: incomplete ${file}`,
      );
  }
  for (const target of exportTargets(packed.exports))
    assert.ok(entries.has(`package/${target.slice(2)}`), `${packed.name}: missing ${target}`);
  for (const [name, target] of binaryEntries(packed))
    assert.ok(
      entries.has(`package/${target.replace(/^\.\//, "")}`),
      `${packed.name}: missing ${name} binary ${target}`,
    );
  // Releases pack with Bun, as here; npm would publish these protocols verbatim.
  for (const dependencies of [
    packed.dependencies,
    packed.devDependencies,
    packed.optionalDependencies,
    packed.peerDependencies,
  ]) {
    for (const [name, version] of Object.entries(dependencies ?? {}))
      assert.ok(
        !/^(?:workspace:|catalog:|file:|link:)/.test(version),
        `${packed.name}: local dependency ${name}`,
      );
  }
  return packed;
}

/** Installs the archive outside the workspace and loads every export with Bun and Node. */
async function checkConsumer(
  archive: string,
  packed: Manifest,
  consumer: string,
  packageDirectory: string,
): Promise<void> {
  // Optional public declaration and runtime contracts use the installed archive,
  // independently of source paths and the workspace's ambient types.
  const fixture = join(packageDirectory, "tests/fixtures/consumer");
  const fixtureManifest: Partial<Manifest> = existsSync(join(fixture, "package.json"))
    ? JSON.parse(await readFile(join(fixture, "package.json"), "utf8"))
    : {};
  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({
      name: "toolkit-artifact-consumer",
      private: true,
      type: "module",
      dependencies: {
        ...packed.peerDependencies,
        ...fixtureManifest.dependencies,
        [packed.name]: archive,
      },
      devDependencies: {
        typescript: rootManifest.devDependencies?.typescript,
        "@types/node": rootManifest.devDependencies?.["@types/node"],
        ...fixtureManifest.devDependencies,
      },
    }),
  );
  run(process.execPath, ["install", "--ignore-scripts"], consumer);

  const specifiers = Object.keys(packed.exports).map((key) => packed.name + key.slice(1));
  const modules = specifiers.filter((specifier) => !specifier.endsWith(".json"));
  // Configuration presets are JSON exports; they load with an import attribute.
  const imports = specifiers.map((specifier) =>
    specifier.endsWith(".json")
      ? `import ${JSON.stringify(specifier)} with { type: "json" };`
      : `import ${JSON.stringify(specifier)};`,
  );
  await writeFile(join(consumer, "exports.mjs"), imports.join("\n"));
  run(process.execPath, ["exports.mjs"], consumer);
  run(node, ["exports.mjs"], consumer);
  const requireSpecifiers = Object.entries(packed.exports)
    .filter(([, target]) => hasRequireCondition(target))
    .map(([key]) => packed.name + key.slice(1));
  if (requireSpecifiers.length > 0) {
    await writeFile(
      join(consumer, "exports.cjs"),
      requireSpecifiers.map((specifier) => `require(${JSON.stringify(specifier)});`).join("\n"),
    );
    run(process.execPath, ["exports.cjs"], consumer);
    run(node, ["exports.cjs"], consumer);
  }
  // Exercise installed bin links outside the workspace, without a database or config.
  for (const [name] of binaryEntries(packed)) {
    for (const binary of [process.execPath, node]) {
      const help = execFileSync(binary, [join(consumer, "node_modules/.bin", name), "--help"], {
        cwd: consumer,
        encoding: "utf8",
        stdio: "pipe",
        timeout: 30_000,
      });
      assert.ok(help.trim().length > 0, `${packed.name}: ${name} --help returned no output`);
    }
  }
  const fixtureTypes = existsSync(join(fixture, "tsconfig.json"));
  const fixtureRuntime = existsSync(join(fixture, "runtime.mjs"));
  if (fixtureTypes || fixtureRuntime)
    await cp(fixture, join(consumer, "contract"), { recursive: true });
  if (fixtureRuntime) {
    run(process.execPath, ["contract/runtime.mjs"], consumer);
    run(node, ["contract/runtime.mjs"], consumer);
  }
  if (modules.length === 0) return;

  // Every JavaScript export must ship declarations a NodeNext consumer resolves.
  const reexports = modules.map(
    (specifier, index) => `export * as module${index} from ${JSON.stringify(specifier)};`,
  );
  await writeFile(join(consumer, "exports.ts"), reexports.join("\n"));
  const typeFiles = ["exports.ts"];
  if (requireSpecifiers.length > 0) {
    await writeFile(
      join(consumer, "exports.cts"),
      requireSpecifiers
        .map(
          (specifier, index) =>
            `import module${index} = require(${JSON.stringify(specifier)});\nexport { module${index} };`,
        )
        .join("\n"),
    );
    typeFiles.push("exports.cts");
  }
  await writeFile(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        strict: true,
        noEmit: true,
        // Peer declarations, such as Drizzle's optional drivers, are not installed.
        skipLibCheck: true,
      },
      files: typeFiles,
    }),
  );
  run(process.execPath, ["--bun", "./node_modules/typescript/bin/tsc"], consumer);
  if (fixtureTypes) {
    run(
      process.execPath,
      ["--bun", "./node_modules/typescript/bin/tsc", "--project", "contract/tsconfig.json"],
      consumer,
    );
  }
}

/** Opt-in contracts for entry points that work without the package's optional peers. */
async function checkWithoutOptionalPeers(
  archive: string,
  packed: Manifest,
  consumer: string,
  packageDirectory: string,
): Promise<void> {
  const fixture = join(packageDirectory, "tests/fixtures/consumer");
  const runtime = existsSync(join(fixture, "without-optional-peers.mjs"));
  const types = existsSync(join(fixture, "without-optional-peers.ts"));
  if (!runtime && !types) return;
  const peers = Object.entries(packed.peerDependencies ?? {});
  const optional = (name: string) => packed.peerDependenciesMeta?.[name]?.optional === true;
  assert.ok(
    peers.some(([name]) => optional(name)),
    `${packed.name}: without-optional-peers contracts require a declared optional peer`,
  );

  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({
      name: "toolkit-without-optional-peers-consumer",
      private: true,
      type: "module",
      dependencies: {
        ...Object.fromEntries(peers.filter(([name]) => !optional(name))),
        [packed.name]: archive,
      },
      devDependencies: {
        typescript: rootManifest.devDependencies?.typescript,
        "@types/node": rootManifest.devDependencies?.["@types/node"],
      },
    }),
  );
  run(process.execPath, ["install", "--ignore-scripts"], consumer);
  await cp(fixture, join(consumer, "contract"), { recursive: true });
  if (runtime) {
    run(process.execPath, ["contract/without-optional-peers.mjs"], consumer);
    run(node, ["contract/without-optional-peers.mjs"], consumer);
  }
  if (types) {
    await writeFile(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          lib: ["ES2022"],
          types: [],
          strict: true,
          noEmit: true,
          skipLibCheck: false,
        },
        files: ["contract/without-optional-peers.ts"],
      }),
    );
    run(process.execPath, ["--bun", "./node_modules/typescript/bin/tsc"], consumer);
  }
  console.log(`${packed.name}@${packed.version}: without-optional-peers consumer passed`);
}

try {
  let checked = 0;
  for (const directory of await readdir(join(root, "packages"), { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const packageDirectory = join(root, "packages", directory.name);
    const manifest = JSON.parse(
      await readFile(join(packageDirectory, "package.json"), "utf8"),
    ) as Manifest;
    if (manifest.private) continue;
    if (releaseArchives && !releaseArchives.has(manifest.name)) continue;
    const archive = releaseArchives?.get(manifest.name) ?? join(temporary, `${directory.name}.tgz`);
    if (!releaseArchives)
      run(
        process.execPath,
        ["pm", "pack", "--ignore-scripts", "--filename", archive],
        packageDirectory,
      );
    const packed = await assertArchive(archive, manifest, packageDirectory);
    await checkConsumer(archive, packed, join(temporary, directory.name), packageDirectory);
    console.log(`${packed.name}@${packed.version}: tarball, Bun and Node consumers passed`);
    await checkWithoutOptionalPeers(
      archive,
      packed,
      join(temporary, `${directory.name}-without-optional-peers`),
      packageDirectory,
    );
    checked += 1;
  }
  if (releaseArchives)
    assert.equal(checked, releaseArchives.size, "Every release archive is checked.");
  else assert.ok(checked > 0, "No public packages were checked.");
} finally {
  if (process.env.TOOLKIT_KEEP_PACK_CHECK === "1") {
    console.log(`Package check files retained at ${temporary}`);
  } else {
    // This path is exclusively created by mkdtemp above, never user-provided.
    await rm(resolve(temporary), { recursive: true, force: true });
  }
}
