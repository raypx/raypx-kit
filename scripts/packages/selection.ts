interface Package {
  name: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  fixtureDependencies?: Record<string, string>;
}

/** Fresh affected jobs need only the selected archives and their local consumer dependencies. */
export function archiveSelection(packages: Package[], requested?: string[]): Set<string> {
  const inventory = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const selected = new Set<string>();
  function visit(name: string) {
    if (selected.has(name)) return;
    const pkg = inventory.get(name);
    if (!pkg) throw new Error(`Unknown public package: ${name}`);
    selected.add(name);
    const dependencies = {
      ...pkg.dependencies,
      ...pkg.optionalDependencies,
      ...pkg.peerDependencies,
      ...pkg.fixtureDependencies,
    };
    for (const dependency of Object.keys(dependencies))
      if (inventory.has(dependency)) visit(dependency);
  }
  for (const name of requested ?? inventory.keys()) visit(name);
  return selected;
}
