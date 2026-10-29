import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withTempDirectory, writeFileAtomic } from "../shared/fs.js";
import {
  assertPackageInventory,
  compatibilityMatrix,
  consumerVersion,
  minimumNode,
  packagesForNode,
  peerVersions,
  type CompatibilityIndex,
  type PeerProfile,
} from "./matrix.js";
import {
  checkConsumer,
  checkWithoutOptionalPeers,
  type Dependencies,
  type Manifest,
} from "./consumers.js";
import { assertToolchainRuntime } from "../checks/toolchain.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const [command, ...args] = process.argv.slice(2);
const options = new Map<string, string>();
for (let index = 0; index < args.length; index += 2) {
  const key = args[index];
  const value = args[index + 1];
  assert.ok(
    key && key.startsWith("--") && value && !value.startsWith("--"),
    "Expected --option value",
  );
  assert.ok(!options.has(key), `Duplicate option ${key}`);
  options.set(key, value);
}
const allowed =
  command === "check" ? ["--artifacts", "--node", "--expected-node", "--peers"] : ["--artifacts"];
for (const key of options.keys()) assert.ok(allowed.includes(key), `Unknown option ${key}`);
const artifacts = resolve(options.get("--artifacts") ?? join(root, ".artifacts/compatibility"));
const indexFile = join(artifacts, "index.json");

async function manifest(file: string): Promise<Manifest> {
  return JSON.parse(await readFile(file, "utf8")) as Manifest;
}

async function publicPackages() {
  const directories = (await readdir(join(root, "packages"), { withFileTypes: true }))
    .filter((directory) => directory.isDirectory())
    .map((directory) => directory.name)
    .sort();
  const packages = [];
  for (const directory of directories) {
    const current = await manifest(join(root, "packages", directory, "package.json"));
    if (!current.private) packages.push({ directory, manifest: current });
  }
  return packages;
}

function digest(contents: Uint8Array): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function prepare(): Promise<CompatibilityIndex> {
  assertToolchainRuntime(root);
  const developmentNode = (
    await readFile(join(root, "scripts/packages/node-version"), "utf8")
  ).trim();
  const lock = await readFile(join(root, "bun.lock"), "utf8");
  const installed = async (
    directory: string,
    declarations: Dependencies,
  ): Promise<Dependencies> => {
    const require = createRequire(join(directory, "package.json"));
    const result: Dependencies = {};
    for (const name of Object.keys(declarations)) {
      const resolved = await manifest(require.resolve(`${name}/package.json`));
      result[name] = consumerVersion(name, resolved, lock);
    }
    return result;
  };
  const rootManifest = await manifest(join(root, "package.json"));
  const compilerDependencies = await installed(root, {
    typescript: rootManifest.devDependencies!.typescript!,
    "@types/node": rootManifest.devDependencies!["@types/node"]!,
  });
  const packages = [];
  for (const { directory, manifest: packed } of await publicPackages()) {
    const packageDirectory = join(root, "packages", directory);
    const fixtureFile = join(packageDirectory, "tests/fixtures/consumer/package.json");
    const fixture = existsSync(fixtureFile) ? await manifest(fixtureFile) : undefined;
    const declarations = { ...packed.peerDependencies, ...fixture?.dependencies };
    const current = await installed(packageDirectory, declarations);
    packages.push({
      directory,
      manifest: packed,
      minimumNode: minimumNode(packed),
      consumerDependencies: declarations,
      profiles: {
        minimum: peerVersions(declarations, current, "minimum"),
        current: peerVersions(declarations, current, "current"),
      },
      fixtureDevDependencies: await installed(packageDirectory, fixture?.devDependencies ?? {}),
      archive: `${directory}.tgz`,
      sha256: "",
    });
  }
  const index: CompatibilityIndex = { version: 1, developmentNode, compilerDependencies, packages };
  compatibilityMatrix(index);
  await mkdir(artifacts, { recursive: true });
  for (const entry of index.packages) {
    const archive = join(artifacts, entry.archive);
    execFileSync(process.execPath, ["pm", "pack", "--filename", archive], {
      cwd: join(root, "packages", entry.directory),
      stdio: "pipe",
    });
    const archived = JSON.parse(
      execFileSync("tar", ["-xOf", archive, "package/package.json"], { encoding: "utf8" }),
    ) as Manifest;
    assert.equal(archived.name, entry.manifest.name);
    assert.equal(archived.version, entry.manifest.version);
    assert.deepEqual(archived.exports, entry.manifest.exports);
    entry.manifest = archived;
    entry.sha256 = digest(await readFile(archive));
  }
  await writeFileAtomic(indexFile, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`Prepared ${index.packages.length} built package archives at ${artifacts}`);
  return index;
}

async function readIndex(): Promise<CompatibilityIndex> {
  return JSON.parse(await readFile(indexFile, "utf8")) as CompatibilityIndex;
}

async function check(): Promise<void> {
  assertToolchainRuntime(root);
  const index = await readIndex();
  assertPackageInventory(index, await publicPackages());
  assert.equal(
    index.developmentNode,
    (await readFile(join(root, "scripts/packages/node-version"), "utf8")).trim(),
    "Compatibility artifact development Node differs from this checkout",
  );
  const expectedNode = options.get("--expected-node");
  const nodeBinary = options.get("--node");
  const peers = options.get("--peers");
  assert.ok(expectedNode && nodeBinary, "check requires --node and --expected-node");
  assert.ok(peers === "minimum" || peers === "current", "check requires --peers minimum|current");
  const actual = execFileSync(nodeBinary, ["-p", "process.versions.node"], {
    encoding: "utf8",
  }).trim();
  assert.equal(actual, expectedNode, "Consumer Node binary does not match its matrix target");
  const packages = packagesForNode(index, expectedNode);
  // Every override is a verified artifact, including dependencies whose own
  // engine floor excludes them from this particular runtime's direct checks.
  for (const entry of index.packages) {
    assert.equal(
      basename(entry.archive),
      entry.archive,
      "Archive must stay inside the artifact directory",
    );
    const archive = join(artifacts, entry.archive);
    assert.equal(
      digest(await readFile(archive)),
      entry.sha256,
      `${entry.manifest.name}: archive digest changed`,
    );
  }
  const packageArchives = Object.fromEntries(
    index.packages.map((entry) => [entry.manifest.name, join(artifacts, entry.archive)]),
  );
  await withTempDirectory("raypx-kit-compatibility-", async (temporary) => {
    for (const entry of packages) {
      const archive = join(artifacts, entry.archive);
      const packageDirectory = join(root, "packages", entry.directory);
      const consumerOptions = {
        bunBinary: process.execPath,
        nodeBinary,
        nodeOnly: true,
        compilerDependencies: index.compilerDependencies,
        dependencies: entry.profiles[peers as PeerProfile],
        fixtureDevDependencies: entry.fixtureDevDependencies,
        packageArchives,
      };
      await checkConsumer(
        archive,
        entry.manifest,
        join(temporary, entry.directory),
        packageDirectory,
        consumerOptions,
      );
      await checkWithoutOptionalPeers(
        archive,
        entry.manifest,
        join(temporary, `${entry.directory}-without-optional-peers`),
        packageDirectory,
        consumerOptions,
      );
      console.log(
        `${entry.manifest.name}: Node ${expectedNode}, ${peers} peers, runtime and types passed`,
      );
    }
  });
}

if (command === "prepare") await prepare();
else if (command === "matrix") console.log(JSON.stringify(compatibilityMatrix(await readIndex())));
else if (command === "check") await check();
else
  throw new Error(
    "Use prepare, matrix or check; see docs/development/README.md#consumer-compatibility-matrix",
  );
