import assert from "node:assert/strict";
import { minVersion, satisfies, valid, validRange } from "semver";
import type { Dependencies, Manifest } from "./consumers.js";

export type PeerProfile = "minimum" | "current";

export interface CompatibilityPackage {
  directory: string;
  manifest: Manifest;
  minimumNode: string;
  consumerDependencies: Dependencies;
  profiles: Record<PeerProfile, Dependencies>;
  fixtureDevDependencies: Dependencies;
  archive: string;
  sha256: string;
}

export interface CompatibilityIndex {
  version: 1;
  developmentNode: string;
  compilerDependencies: Dependencies;
  packages: CompatibilityPackage[];
}

/** Exact lower bounds include prereleases only when the declaration admits them. */
export function minimumVersion(range: string, owner: string): string {
  assert.ok(validRange(range), `${owner}: invalid semver range ${range}`);
  const minimum = minVersion(range)?.version;
  assert.ok(minimum && satisfies(minimum, range), `${owner}: no supported minimum in ${range}`);
  return minimum;
}

export function minimumNode(manifest: Manifest): string {
  if (manifest.engines?.node)
    return minimumVersion(manifest.engines.node, `${manifest.name} engines.node`);
  const targets = (value: unknown): string[] => {
    if (typeof value === "string") return [value];
    if (value && typeof value === "object") return Object.values(value).flatMap(targets);
    return [];
  };
  const exports = targets(manifest.exports);
  assert.ok(
    exports.length > 0 && exports.every((target) => target.endsWith(".json")),
    `${manifest.name}: JavaScript packages must declare engines.node`,
  );
  // Configuration-only packages also load at the oldest library runtime floor.
  return "22.21.0";
}

/** A workspace install of a consumer dependency, possibly through an npm alias. */
export interface InstalledPackage {
  name: string;
  version: string;
  /** Upstream versions an alias, such as Vite+ core for `vite`, ships under that name. */
  bundledVersions?: Record<string, string>;
}

/**
 * The published version consumers install for a dependency the workspace resolves.
 * An npm alias installs another package under the requested name, so its own version
 * means nothing to consumers; the upstream version it bundles stands in for it.
 */
export function consumerVersion(name: string, installed: InstalledPackage, lock: string): string {
  const locked = `${installed.name}@${installed.version}`;
  assert.ok(lock.includes(JSON.stringify(locked)), `${locked}: not in bun.lock`);
  if (installed.name === name) return installed.version;
  const version = installed.bundledVersions?.[name];
  assert.ok(version, `${name}: alias ${locked} declares no bundled ${name} version`);
  return version;
}

/** Never resolve a range to a newly published release in the current profile. */
export function peerVersions(
  declarations: Dependencies,
  current: Dependencies,
  profile: PeerProfile,
): Dependencies {
  return Object.fromEntries(
    Object.entries(declarations).map(([name, range]) => {
      const version = profile === "minimum" ? minimumVersion(range, name) : current[name];
      assert.ok(version && valid(version), `${name}: missing exact installed version`);
      assert.ok(satisfies(version, range), `${name}@${version} does not satisfy ${range}`);
      return [name, version];
    }),
  );
}

/** Separate engine minima from the pinned runtime that builds the archives. */
export function compatibilityMatrix(index: CompatibilityIndex) {
  assert.equal(index.version, 1, "Unsupported compatibility artifact format");
  assert.ok(valid(index.developmentNode), "Invalid development Node pin");
  assert.ok(index.packages.length > 0, "No public packages in compatibility matrix");
  for (const entry of index.packages) {
    assert.equal(
      entry.minimumNode,
      minimumNode(entry.manifest),
      `${entry.manifest.name}: minimum Node differs from its declared engine floor`,
    );
    assert.ok(
      satisfies(index.developmentNode, entry.manifest.engines?.node ?? "*"),
      `${entry.manifest.name}: development Node is outside its engines range`,
    );
    for (const [name, range] of Object.entries(entry.manifest.peerDependencies ?? {})) {
      assert.equal(
        entry.consumerDependencies[name],
        range,
        `${entry.manifest.name}: consumer dependency changed peer ${name}`,
      );
    }
    assert.deepEqual(
      entry.profiles.minimum,
      peerVersions(entry.consumerDependencies, entry.profiles.current, "minimum"),
      `${entry.manifest.name}: minimum peer profile changed`,
    );
    assert.deepEqual(
      entry.profiles.current,
      peerVersions(entry.consumerDependencies, entry.profiles.current, "current"),
      `${entry.manifest.name}: current peer profile changed`,
    );
  }
  const nodes = [
    ...new Set([...index.packages.map((entry) => entry.minimumNode), index.developmentNode]),
  ];
  return {
    include: nodes.flatMap((node) =>
      (["minimum", "current"] as const).map((peers) => ({ node, peers })),
    ),
  };
}

export function packagesForNode(index: CompatibilityIndex, node: string): CompatibilityPackage[] {
  assert.ok(
    compatibilityMatrix(index).include.some((entry) => entry.node === node),
    `Node ${node} is not a declared compatibility target`,
  );
  return index.packages.filter(
    (entry) => node === index.developmentNode || entry.minimumNode === node,
  );
}

/** An otherwise valid artifact must not silently omit a newly added public package. */
export function assertPackageInventory(
  index: CompatibilityIndex,
  packages: { directory: string; manifest: Manifest }[],
): void {
  const inventory = (entries: { directory: string; manifest: Manifest }[]) =>
    entries
      .map(({ directory, manifest }) => ({
        directory,
        name: manifest.name,
        version: manifest.version,
        exports: manifest.exports,
        engines: manifest.engines,
        peerDependencies: manifest.peerDependencies,
        peerDependenciesMeta: manifest.peerDependenciesMeta,
      }))
      .sort((left, right) => left.directory.localeCompare(right.directory));
  assert.deepEqual(
    inventory(index.packages),
    inventory(packages),
    "Compatibility artifact public packages differ from this checkout",
  );
}
