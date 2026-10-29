import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertToolchainRuntime } from "../checks/toolchain.js";

import { checkConsumer, checkWithoutOptionalPeers, type Manifest } from "./consumers.js";
import { archiveSelection } from "./selection.js";

interface PlanEntry {
  kind: string;
  name: string;
  tarball: { path: string };
}

const root = fileURLToPath(new URL("../../", import.meta.url));
assertToolchainRuntime(root);
const rootManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as Manifest;
const temporary = await mkdtemp(join(tmpdir(), "raypx-kit-pack-"));
// Release packing checks the exact archives it will publish instead of packing again.
const releasePlan = process.env.TOOLKIT_RELEASE_PLAN;
const requested: unknown = process.env.TOOLKIT_PACKAGES
  ? JSON.parse(process.env.TOOLKIT_PACKAGES)
  : undefined;
assert.ok(
  requested === undefined ||
    (Array.isArray(requested) &&
      requested.length > 0 &&
      requested.every((name) => typeof name === "string")),
  "TOOLKIT_PACKAGES must name packages",
);
assert.ok(!releasePlan || !requested, "Release checking cannot filter its planned archives");
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
  assert.equal(packed.license, manifest.license, `${packed.name}: license metadata changed`);
  assert.deepEqual(packed.author, manifest.author, `${packed.name}: author metadata changed`);
  assert.deepEqual(
    packed.peerDependenciesMeta,
    manifest.peerDependenciesMeta,
    `${packed.name}: peer dependency metadata changed in the archive`,
  );
  for (const file of ["LICENSE", "README.md"])
    assert.ok(entries.has(`package/${file}`), `${packed.name}: missing ${file}`);
  for (const directory of ["node_modules", "third-party"])
    assert.ok(![...entries].some((entry) => entry.startsWith(`package/${directory}/`)));
  const legalFiles = [
    "LICENSE",
    ...["NOTICE", "NOTICE.md", "THIRD_PARTY_LICENSES.txt"].filter((file) =>
      manifest.files?.includes(file),
    ),
  ];
  for (const file of legalFiles) {
    assert.ok(entries.has(`package/${file}`), `${packed.name}: missing ${file}`);
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

try {
  let checked = 0;
  const packages: {
    directory: string;
    packageDirectory: string;
    archive: string;
    packed: Manifest;
  }[] = [];
  const inventory = [];
  for (const directory of await readdir(join(root, "packages"), { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const packageDirectory = join(root, "packages", directory.name);
    const manifest = JSON.parse(
      await readFile(join(packageDirectory, "package.json"), "utf8"),
    ) as Manifest;
    if (manifest.private) continue;
    let fixtureDependencies;
    try {
      fixtureDependencies = (
        JSON.parse(
          await readFile(join(packageDirectory, "tests/fixtures/consumer/package.json"), "utf8"),
        ) as Manifest
      ).dependencies;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    inventory.push({ directory: directory.name, packageDirectory, manifest, fixtureDependencies });
  }
  const selected = archiveSelection(
    inventory.map(({ manifest, fixtureDependencies }) => ({
      ...manifest,
      ...(fixtureDependencies ? { fixtureDependencies } : {}),
    })),
    requested as string[] | undefined,
  );
  for (const { directory, packageDirectory, manifest } of inventory) {
    if (!selected.has(manifest.name)) continue;
    if (releaseArchives && !releaseArchives.has(manifest.name)) continue;
    const archive = releaseArchives?.get(manifest.name) ?? join(temporary, `${directory}.tgz`);
    if (!releaseArchives)
      run(process.execPath, ["pm", "pack", "--filename", archive], packageDirectory);
    const packed = await assertArchive(archive, manifest, packageDirectory);
    packages.push({ directory, packageDirectory, archive, packed });
  }
  // Install internal dependencies from the same archives, including new packages
  // that have not been published to the registry yet.
  const packageArchives = Object.fromEntries(
    packages.map(({ packed, archive }) => [packed.name, archive]),
  );
  if (requested)
    for (const name of requested as string[])
      assert.ok(packageArchives[name], `Unknown public package: ${name}`);
  for (const { directory, packageDirectory, archive, packed } of packages) {
    if (requested && !(requested as string[]).includes(packed.name)) continue;
    const options = {
      bunBinary: process.execPath,
      compilerDependencies: {
        typescript: rootManifest.devDependencies!.typescript!,
        "@types/node": rootManifest.devDependencies!["@types/node"]!,
      },
      packageArchives,
    };
    await checkConsumer(archive, packed, join(temporary, directory), packageDirectory, options);
    console.log(`${packed.name}@${packed.version}: tarball and Bun consumer passed`);
    await checkWithoutOptionalPeers(
      archive,
      packed,
      join(temporary, `${directory}-without-optional-peers`),
      packageDirectory,
      options,
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
