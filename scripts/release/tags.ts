/**
 * Dist-tag for a prerelease in pre mode. Until a package has a stable version,
 * `latest` must follow its newest prerelease so `npm install <name>` resolves it.
 *
 * Changesets only does this while every published version carries the pre tag.
 * npm's staged publishing leaves a `0.0.0-stage` placeholder version, which makes
 * Changesets fall back to the pre tag and leave `latest` on the first release.
 * Only a stable version (one without a prerelease suffix) keeps `latest` unchanged.
 */
export function prereleaseDistTag(publishedVersions: readonly string[], preTag: string): string {
  return publishedVersions.some((version) => !version.includes("-")) ? preTag : "latest";
}
