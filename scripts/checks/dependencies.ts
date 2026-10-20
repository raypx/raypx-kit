import { globSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { satisfies } from "semver";

type Dependencies = Record<string, string>;

interface Manifest {
  name?: string;
  version?: string;
  workspaces?: string[] | { packages?: string[] };
  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  optionalDependencies?: Dependencies;
  peerDependencies?: Dependencies;
  overrides?: Dependencies;
}

interface Workspace {
  file: string;
  manifest: Manifest;
  require: NodeJS.Require;
}

interface InstalledPackage {
  path: string;
  manifest: Manifest & { version: string };
}

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

function dependencyRange(manifest: Manifest, name: string): string | undefined {
  for (const field of dependencyFields) {
    const range = manifest[field]?.[name];
    if (range) return range;
  }
  return undefined;
}

/** Check installed combinations rather than freezing their dependency declarations. */
export function checkDependencyCompatibility(root: string): string[] {
  const findings: string[] = [];
  const report = (message: string) => {
    findings.push(`${message}. Update compatible dependencies together in bun.lock.`);
  };
  const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
  const installed = (
    require: NodeJS.Require,
    name: string,
    owner: string,
  ): InstalledPackage | undefined => {
    try {
      const path = require.resolve(`${name}/package.json`);
      const manifest = readManifest(path);
      if (!manifest.version) throw new Error("package metadata has no version");
      return { path, manifest: { ...manifest, version: manifest.version } };
    } catch (error) {
      report(`${owner}: cannot inspect installed ${name}: ${message(error)}`);
      return undefined;
    }
  };
  const checkRange = (owner: string, name: string, range: string, version: string) => {
    // Aliases keep the installed package's version while renaming its specifier.
    const constraint = range.startsWith("npm:") ? range.slice(range.lastIndexOf("@") + 1) : range;
    if (!satisfies(version, constraint))
      report(`${owner}: installed ${name}@${version} does not satisfy ${range}`);
  };
  const checkDeclaration = (workspace: Workspace, name: string, version: string) => {
    const range = dependencyRange(workspace.manifest, name);
    if (range) checkRange(workspace.file, name, range, version);
  };
  const checkCore = (
    require: NodeJS.Require,
    owner: string,
    expected: string,
  ): InstalledPackage | undefined => {
    const core = installed(require, "vite", owner);
    if (core) {
      if (core.manifest.name !== "@voidzero-dev/vite-plus-core")
        report(
          `${owner}: vite resolves to ${core.manifest.name ?? "an unnamed package"}, expected the Vite+ core alias`,
        );
      if (core.manifest.version !== expected)
        report(
          `${owner}: Vite+ core is ${core.manifest.version}, expected Vite+ release ${expected}`,
        );
    }
    return core;
  };

  let workspaces: Workspace[];
  try {
    root = resolve(root);
    const rootManifest = readManifest(join(root, "package.json"));
    const patterns = Array.isArray(rootManifest.workspaces)
      ? rootManifest.workspaces
      : (rootManifest.workspaces?.packages ?? []);
    const files = [
      "package.json",
      ...globSync(
        patterns.map((pattern) => `${pattern}/package.json`),
        { cwd: root },
      ).sort(),
    ];
    workspaces = [...new Set(files)].map((file) => ({
      file,
      manifest: readManifest(join(root, file)),
      require: createRequire(join(root, file)),
    }));
  } catch (error) {
    report(`Cannot inspect workspace dependency declarations: ${message(error)}`);
    return findings;
  }

  const rootWorkspace = workspaces.find((workspace) => workspace.file === "package.json")!;
  const docsWorkspace = workspaces.find((workspace) => workspace.file === "docs/package.json");
  if (!docsWorkspace) report("docs/package.json: documentation workspace is missing");

  let rootVitePlus: string | undefined;
  let bundledVitest: string | undefined;
  for (const workspace of [rootWorkspace, ...(docsWorkspace ? [docsWorkspace] : [])]) {
    const vitePlus = installed(workspace.require, "vite-plus", workspace.file);
    if (!vitePlus) continue;
    const version = vitePlus.manifest.version;
    checkDeclaration(workspace, "vite-plus", version);
    if (workspace === rootWorkspace) rootVitePlus = version;
    else if (rootVitePlus && version !== rootVitePlus)
      report(`${workspace.file}: Vite+ is ${version}, expected root Vite+ ${rootVitePlus}`);

    const fromVitePlus = createRequire(vitePlus.path);
    const core = checkCore(fromVitePlus, `${workspace.file} (vite-plus)`, version);
    if (workspace === rootWorkspace && core && workspace.manifest.overrides?.vite)
      checkRange(
        "package.json overrides",
        "vite",
        workspace.manifest.overrides.vite,
        core.manifest.version,
      );
    if (dependencyRange(workspace.manifest, "vite")) {
      const directCore = checkCore(workspace.require, workspace.file, version);
      if (directCore) checkDeclaration(workspace, "vite", directCore.manifest.version);
    }

    try {
      const { versions } = fromVitePlus("vite-plus/versions") as { versions?: { vitest?: string } };
      if (!versions?.vitest) throw new Error("public versions metadata has no Vitest version");
      if (workspace === rootWorkspace) bundledVitest = versions.vitest;
      const vitest = installed(fromVitePlus, "vitest", `${workspace.file} (vite-plus)`);
      if (vitest && vitest.manifest.version !== versions.vitest)
        report(
          `${workspace.file}: installed Vitest is ${vitest.manifest.version}, expected bundled Vitest ${versions.vitest}`,
        );
    } catch (error) {
      report(`${workspace.file}: cannot inspect vite-plus/versions: ${message(error)}`);
    }
  }

  for (const workspace of workspaces) {
    if (!dependencyRange(workspace.manifest, "@vitest/coverage-v8")) continue;
    const provider = installed(workspace.require, "@vitest/coverage-v8", workspace.file);
    if (!provider) continue;
    checkDeclaration(workspace, "@vitest/coverage-v8", provider.manifest.version);
    if (!bundledVitest) continue;
    if (provider.manifest.version !== bundledVitest)
      report(
        `${workspace.file}: coverage-v8 is ${provider.manifest.version}, expected bundled Vitest ${bundledVitest}`,
      );
    const peer = provider.manifest.peerDependencies?.vitest;
    if (peer) checkRange(`${workspace.file} coverage-v8 peer`, "vitest", peer, bundledVitest);
  }

  if (docsWorkspace) {
    const baseUI = installed(docsWorkspace.require, "@fumadocs/base-ui", docsWorkspace.file);
    const core = installed(docsWorkspace.require, "fumadocs-core", docsWorkspace.file);
    if (baseUI) checkDeclaration(docsWorkspace, "@fumadocs/base-ui", baseUI.manifest.version);
    if (core) checkDeclaration(docsWorkspace, "fumadocs-core", core.manifest.version);
    if (baseUI && core) {
      if (baseUI.manifest.version !== core.manifest.version)
        report(
          `${docsWorkspace.file}: Fumadocs Base UI is ${baseUI.manifest.version}, but core is ${core.manifest.version}`,
        );
      const peer = baseUI.manifest.peerDependencies?.["fumadocs-core"];
      if (peer)
        checkRange(
          `${docsWorkspace.file} @fumadocs/base-ui peer`,
          "fumadocs-core",
          peer,
          core.manifest.version,
        );
    }
  }

  return findings;
}
