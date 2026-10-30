import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vite-plus/test";
import { verifiedArchives } from "../../../scripts/release/archives.js";
it("imports exact verified bytes and rejects mismatched commits, versions and tampering", async () => {
  const root = await mkdtemp(join(tmpdir(), "verified-archives-"));
  try {
    await mkdir(join(root, "package"));
    const manifest = {
      name: "@raypx-kit/fixture",
      version: "0.0.0-alpha.1",
      exports: { ".": "./index.mjs" },
      engines: { node: ">=22.21" },
    };
    await writeFile(join(root, "package/package.json"), JSON.stringify(manifest));
    execFileSync("tar", ["-czf", join(root, "fixture.tgz"), "package"], { cwd: root });
    const bytes = await readFile(join(root, "fixture.tgz"));
    const entry = {
      directory: "fixture",
      manifest,
      minimumNode: "22.21.0",
      consumerDependencies: {},
      profiles: { minimum: {}, current: {} },
      fixtureDevDependencies: {},
      archive: "fixture.tgz",
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    const index = {
      version: 2,
      commit: "a".repeat(40),
      developmentNode: "24.22.0",
      compilerDependencies: {},
      packages: [entry],
    };
    const save = () => writeFile(join(root, "index.json"), JSON.stringify(index));
    await save();
    expect((await verifiedArchives(root, index.commit)).get(manifest.name)?.integrity).toBe(
      `sha256-${createHash("sha256").update(bytes).digest("base64")}`,
    );
    await expect(verifiedArchives(root, "b".repeat(40))).rejects.toThrow("another commit");
    entry.manifest = { ...manifest, version: "0.0.0-alpha.2" };
    await save();
    await expect(verifiedArchives(root, index.commit)).rejects.toThrow("version differs");
    entry.manifest = manifest;
    await save();
    await writeFile(join(root, "fixture.tgz"), "tampered");
    await expect(verifiedArchives(root, index.commit)).rejects.toThrow("digest changed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
