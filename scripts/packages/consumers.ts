import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { stringifyYAML } from "confbox/yaml";

export type Dependencies = Record<string, string>;

export interface Manifest {
  name: string;
  version: string;
  license?: string;
  author?: unknown;
  private?: boolean;
  files?: string[];
  exports: Record<string, unknown>;
  bin?: string | Record<string, string>;
  engines?: { node?: string };
  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  optionalDependencies?: Dependencies;
  peerDependencies?: Dependencies;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

export interface ConsumerOptions {
  nodeBinary: string;
  compilerDependencies: Dependencies;
  dependencies?: Dependencies;
  fixtureDevDependencies?: Dependencies;
  /** Archives from this verification batch replace internal registry dependencies. */
  packageArchives?: Dependencies;
}

// pnpm's executable shims add workspace modules to NODE_PATH. Isolated consumers
// must resolve only their own installation, including when checking absent peers.
const consumerEnvironment = { ...process.env };
delete consumerEnvironment.NODE_PATH;

function run(binary: string, args: string[], cwd: string): string {
  return execFileSync(binary, args, {
    cwd,
    env: consumerEnvironment,
    encoding: "utf8",
    stdio: "pipe",
  });
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

async function installConsumer(
  directory: string,
  manifest: Pick<Manifest, "name" | "dependencies" | "devDependencies">,
  packageArchives: Dependencies = {},
): Promise<void> {
  await mkdir(directory);
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({ private: true, type: "module", ...manifest }),
  );
  await writeFile(
    join(directory, "pnpm-workspace.yaml"),
    stringifyYAML({
      overrides: packageArchives,
      autoInstallPeers: false,
      strictPeerDependencies: false,
    }),
  );
  run("pnpm", ["install", "--ignore-scripts", "--no-frozen-lockfile"], directory);
}

/** Installs the archive outside the workspace and loads every export with Node. */
export async function checkConsumer(
  archive: string,
  packed: Manifest,
  consumer: string,
  packageDirectory: string,
  options: ConsumerOptions,
): Promise<void> {
  // Optional public declaration and runtime contracts use the installed archive,
  // independently of source paths and the workspace's ambient types.
  const fixture = join(packageDirectory, "tests/fixtures/consumer");
  const fixtureManifest: Partial<Manifest> = existsSync(join(fixture, "package.json"))
    ? JSON.parse(await readFile(join(fixture, "package.json"), "utf8"))
    : {};
  await installConsumer(
    consumer,
    {
      name: "toolkit-artifact-consumer",
      dependencies: {
        ...packed.peerDependencies,
        ...fixtureManifest.dependencies,
        ...options.dependencies,
        [packed.name]: archive,
      },
      devDependencies: {
        ...options.compilerDependencies,
        ...fixtureManifest.devDependencies,
        ...options.fixtureDevDependencies,
      },
    },
    options.packageArchives,
  );
  if (options.dependencies) {
    const require = createRequire(join(consumer, "package.json"));
    for (const [name, expected] of Object.entries(options.dependencies)) {
      const installed = await installedManifest(require, name);
      assert.equal(
        installed.version,
        expected,
        `${packed.name}: installed ${name} differs from the exact compatibility profile`,
      );
    }
  }

  const specifiers = Object.keys(packed.exports).map((key) => packed.name + key.slice(1));
  const modules = specifiers.filter(
    (specifier) => !specifier.endsWith(".json") && !specifier.endsWith(".css"),
  );
  // JSON presets load through both their ESM and CommonJS package exports.
  const imports = specifiers.map((specifier) =>
    specifier.endsWith(".json")
      ? `createRequire(import.meta.url)(${JSON.stringify(specifier)});\nawait import(${JSON.stringify(specifier)}, { with: { type: "json" } });`
      : specifier.endsWith(".css")
        ? `if (!(await readFile(new URL(import.meta.resolve(${JSON.stringify(specifier)})), "utf8")).trim()) throw new Error("Empty stylesheet export: " + ${JSON.stringify(specifier)});`
        : `import ${JSON.stringify(specifier)};`,
  );
  await writeFile(
    join(consumer, "exports.mjs"),
    [
      'import { createRequire } from "node:module";',
      'import { readFile } from "node:fs/promises";',
      ...imports,
    ].join("\n"),
  );
  run(options.nodeBinary, ["exports.mjs"], consumer);
  const requireSpecifiers = Object.entries(packed.exports)
    .filter(([key, target]) => !key.endsWith(".css") && hasRequireCondition(target))
    .map(([key]) => packed.name + key.slice(1));
  if (requireSpecifiers.length > 0) {
    await writeFile(
      join(consumer, "exports.cjs"),
      requireSpecifiers.map((specifier) => `require(${JSON.stringify(specifier)});`).join("\n"),
    );
    run(options.nodeBinary, ["exports.cjs"], consumer);
  }
  // Exercise installed bin links outside the workspace, without a database or config.
  for (const [name, target] of binaryEntries(packed)) {
    assert.ok(
      existsSync(join(consumer, "node_modules/.bin", name)),
      `${packed.name}: missing installed binary ${name}`,
    );
    const help = execFileSync(
      options.nodeBinary,
      [realpathSync(join(consumer, "node_modules", packed.name, target)), "--help"],
      {
        cwd: consumer,
        env: consumerEnvironment,
        encoding: "utf8",
        stdio: "pipe",
        timeout: 30_000,
      },
    );
    assert.ok(help.trim().length > 0, `${packed.name}: ${name} --help returned no output`);
  }
  const fixtureTypes = existsSync(join(fixture, "tsconfig.json"));
  const fixtureRuntime = existsSync(join(fixture, "runtime.mjs"));
  if (fixtureTypes || fixtureRuntime)
    await cp(fixture, join(consumer, "contract"), { recursive: true });
  if (fixtureRuntime) run(options.nodeBinary, ["contract/runtime.mjs"], consumer);
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
  run(options.nodeBinary, ["./node_modules/typescript/bin/tsc"], consumer);
  if (fixtureTypes) {
    run(
      options.nodeBinary,
      ["./node_modules/typescript/bin/tsc", "--project", "contract/tsconfig.json"],
      consumer,
    );
  }
}

/** Opt-in contracts for entry points that work without the package's optional peers. */
export async function checkWithoutOptionalPeers(
  archive: string,
  packed: Manifest,
  consumer: string,
  packageDirectory: string,
  options: ConsumerOptions,
): Promise<void> {
  const fixture = join(packageDirectory, "tests/fixtures/consumer/without-optional-peers");
  const runtime = existsSync(join(fixture, "runtime.mjs"));
  const types = existsSync(join(fixture, "types.ts"));
  if (!runtime && !types) return;
  const peers = Object.entries(packed.peerDependencies ?? {});
  const optional = (name: string) => packed.peerDependenciesMeta?.[name]?.optional === true;
  assert.ok(
    peers.some(([name]) => optional(name)),
    `${packed.name}: without-optional-peers contracts require a declared optional peer`,
  );

  await installConsumer(
    consumer,
    {
      name: "toolkit-without-optional-peers-consumer",
      dependencies: {
        ...Object.fromEntries(
          peers
            .filter(([name]) => !optional(name))
            .map(([name, range]) => [name, options.dependencies?.[name] ?? range]),
        ),
        [packed.name]: archive,
      },
      devDependencies: options.compilerDependencies,
    },
    options.packageArchives,
  );
  await cp(fixture, join(consumer, "contract"), { recursive: true });
  if (runtime) run(options.nodeBinary, ["contract/runtime.mjs"], consumer);
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
        files: ["contract/types.ts"],
      }),
    );
    run(options.nodeBinary, ["./node_modules/typescript/bin/tsc"], consumer);
  }
  console.log(`${packed.name}@${packed.version}: without-optional-peers consumer passed`);
}

/** Read installed metadata even when a package does not export package.json. */
export async function installedManifest(require: NodeJS.Require, name: string): Promise<Manifest> {
  const file = (require.resolve.paths(name) ?? [])
    .map((path) => join(path, name, "package.json"))
    .find(existsSync);
  assert.ok(file, `Missing installed package: ${name}`);
  return JSON.parse(await readFile(file, "utf8")) as Manifest;
}
