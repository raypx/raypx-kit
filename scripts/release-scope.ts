import assert from "node:assert/strict";

/** Only this repository's independently versioned libraries may be released. */
export const releaseScope = "@raypx-kit/";

export function assertReleasePackage(name: string): void {
  assert.ok(name.startsWith(releaseScope), `${name}: outside the @raypx-kit scope`);
}

/** Accept short CLI names and retain exact scoped names without widening the scope. */
export function snapshotPackageNames(packages: readonly string[]): string[] {
  const names = [
    ...new Set(packages.map((name) => (name.startsWith("@") ? name : `${releaseScope}${name}`))),
  ];
  for (const name of names) assertReleasePackage(name);
  return names;
}
