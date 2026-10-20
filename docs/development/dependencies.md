# Dependency policy

Declare third-party dependencies in the owning workspace's `package.json`.
Stable dependencies and development tools use caret ranges from a compatible
tested release. Peer ranges describe supported consumer versions; do not narrow
them merely to match the development install. Internal dependencies use
`workspace:*`.

The committed `bun.lock` records the tested resolution. CI installs it with
`bun install --frozen-lockfile --ignore-scripts`. Changing a range does not
authorize silently replacing copied source or changing bundled dependency
provenance.

## Compatibility requirements

`bun run toolchain:check` enforces the installed Vite+/core, coverage and Fumadocs
pairings below, including their declarations and peer ranges. Drizzle and Nitro
also rely on constrained prerelease ranges and affected package checks. Update
related dependencies together and commit the resulting lockfile:

| Group               | Declaration and installed-version constraint                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite+ and Vite core | Caret ranges; the root override and docs alias select Vite+'s core package. Installed Vite+ and core release versions must match.                                          |
| Vitest coverage     | Caret ranges; every installed provider must match Vite+'s bundled Vitest and satisfy its peer range. Do not add a separate Vitest version.                                 |
| Fumadocs            | `@fumadocs/base-ui` and `fumadocs-core` use caret ranges and must resolve to the same release while satisfying their peers. The site uses the official Base UI components. |
| Drizzle ORM and CLI | `>=1.0.0-rc.5-5935859 <1.0.0-rc.5-z` restricts resolution to the RC5 hash family. Validate ORM, CLI and consumer fixtures together.                                        |
| Nitro               | `~3.0.260903-beta` preserves the tested prerelease family and the documentation site's `bun` preset.                                                                       |

The slim Drizzle Kit distribution retains upstream runtime dependency names and
existing ranges. Exact upstream versions become caret ranges that include those
versions; extractor tests check that upstream ranges remain supported. The copied
CLI and declarations stay unchanged. Review these dependencies whenever the
upstream build changes.

Node and Bun runtime pins remain exact in `.nvmrc` and root `packageManager`.
`@types/node` follows the pinned Node major; an `@types/bun` declaration starts at
the pinned Bun version. Public package engine ranges describe consumer support
independently of repository development pins.

The [consumer compatibility matrix](README.md#consumer-compatibility-matrix)
tests the exact Node and peer lower bounds alongside the development Node and
locked peer versions. When changing a support range, review the resulting matrix
and its public runtime and declaration contracts. Keep the development runtime
pin unchanged when selecting additional consumer binaries.

## Peers and bundled dependencies

Keep consumer-owned framework and ORM instances external. Drizzle ORM is an
optional peer for Drizzle's independent error/result entries, while SQL and ORM
integration entries still require it. Env keeps Zod external as a required peer.
Intl keeps React external and required, including for root/server usage.

Intl bundles `use-intl` and its FormatJS dependencies from their public APIs.
Its tsdown configuration restricts which dependencies may be bundled. Installing
another `use-intl` instance does not share Intl's bundled context; applications
import translation and provider APIs through `@raypx-kit/intl`.

When upgrading bundled or adapted dependencies, review the locked versions,
package license texts and source notices alongside the build output. Preserve
complete upstream licenses and pinned provenance.

## Updating dependencies

1. Review the affected manifests, upstream compatibility requirements and copied
   source constraints. Keep related groups compatible rather than widening ranges
   independently.
2. Refresh the Bun lockfile and run `bun run doctor` and
   `bun run toolchain:check` against the installed resolution.
3. Run affected workspace checks, tests and builds. If Vite+, the test runtime or
   coverage changes, run affected `test:coverage` commands as well: the normal
   verification gate does not enable coverage.
4. Run `bun run verify`, which includes documentation, archive consumers and
   Changesets fixtures. Review the manifest and lockfile changes with these results.

For a runtime upgrade, change its authoritative pin first, then update dependent
declarations reported by `toolchain:check`, including CI, types and documented
versions. CI reads the same two pin files. Follow the
[Changesets workflow](changesets.md) when an update affects a published package.
