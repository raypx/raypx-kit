# Development

This guide covers repository setup, daily checks and adding packages. See the
[architecture guide](../architecture/README.md) for package boundaries,
[dependency policy](dependencies.md) for upgrades, and the
[Changesets workflow](changesets.md) for version preparation.

## Setup

Use Bun **1.4.3** and Node **24.22.0**. The root `packageManager` is the
authoritative Bun pin; `.nvmrc` is the authoritative Node pin. Published packages
declare their own supported Node ranges independently.

mise is the recommended version manager. `mise.toml` enables reading those two
files and must not add a second set of versions under `[tools]`.

```sh
mise trust && mise install
eval "$(mise activate zsh)" # use the matching activation command for your shell
bun install --frozen-lockfile --ignore-scripts
bun run doctor
bun run toolchain:check
```

Activate mise in your shell configuration, or prefix commands with
`mise exec --`. Other version managers work when they select the same pins.
Keep Node on `PATH`: direct tool binaries use their Node shebangs.
`TOOLKIT_NODE_BINARY` selects a matching Node executable for `doctor` and isolated
archive consumers; it does not replace Node on `PATH` for the other tools.

Install dependencies before using repository commands. `doctor` checks the active
executables; `toolchain:check` checks version declarations, CI configuration,
documented versions and installed dependency combinations.

## Daily commands

| Command                  | What it checks or runs                                           |
| ------------------------ | ---------------------------------------------------------------- |
| `bun run lint`           | Vite+ formatting and lint checks                                 |
| `bun run format`         | Apply Vite+ formatting                                           |
| `bun run check`          | Root and workspace TypeScript checks                             |
| `bun run knip`           | Unused source files, dependencies and internal exports           |
| `bun run test:toolchain` | Root maintenance tests and documentation tests                   |
| `bun run test`           | Maintenance/documentation tests, then workspace tests            |
| `bun run build`          | Workspace checks and builds, including the documentation site    |
| `bun run pack:check`     | Pack current package output and check isolated archive consumers |
| `bun run release:check`  | Changesets versioning rules in disposable local fixtures         |
| `bun run verify`         | The complete CI gate                                             |

Start with the affected package's narrow checks:

```sh
bun run --cwd packages/drizzle check
bun run --cwd packages/drizzle test
bun run build --filter=@raypx-kit/drizzle
```

`verify` runs runtime and declaration checks, lint, types, Knip, maintenance tests,
workspace tests and builds, archive consumers, then Changesets fixtures. CI runs
the same command. The normal gate does not enable coverage or require a database.
Run a package's `test:coverage` after changing its test runtime or coverage provider;
real database tests require an explicitly selected disposable database.

## Tool and test boundaries

Bun owns installation and script orchestration. Turbo schedules workspace tasks;
`build` depends on that workspace's `check` and dependency builds. Vite+ owns
formatting, linting, tests and the documentation application's Vite commands.
tsdown builds the five ESM libraries and their declarations. Drizzle Kit copies
upstream artifacts through its extractor; TSConfig publishes its JSON presets
directly.

Package scripts invoke `turbo`, `tsdown`, `changeset`, `knip`, `vp check` and
`vp fmt` directly. Tests retain `bun --bun vp` because workers use Bun-specific
flags and the Intl jsdom preload. The documentation site's development, build and
preview commands also retain Bun: Nitro's `bun` output requires it during
prerendering. Repository TypeScript scripts, native type checks and archive
packing use Bun explicitly.

Workspace checks use `bun --check --tsconfig-override tsconfig.json` without a
source entrypoint. This invokes Bun's native type checker rather than resolving
the `check` package script. Every workspace extends an `@raypx-kit/tsconfig`
preset; the private root declares this shared workspace dependency.

Keep tests under each workspace's `tests/`. Root maintenance tests live in
`tests/scripts/`, documentation tests in `docs/tests/`, and shared preloads in
`tests/setup/`. Package `vitest.config.ts` files import `workspaceTests` from root
`test.config.ts`. Type checks include tests; library build configs include only
`src/`.

Knip reads public library roots from the explicit tsdown entries, so an API does
not need a workspace caller to remain public. It also models maintenance scripts,
framework routes and configuration entries. Keep exceptions in `knip.ts` narrow
and explain the dynamic usage; do not make every source file an entry to suppress
findings.

## CI runner baseline

CI and release jobs use GitHub-hosted x64 `ubuntu-24.04` runners. Keep all jobs
on the same explicit OS label. GitHub is moving `ubuntu-latest` to Ubuntu 26.04;
see the [runner image announcement](https://github.com/actions/runner-images/issues/14748).
An explicit label keeps that alias change from moving the repository's OS baseline.
GitHub still updates software within the selected image; this is not an immutable
image pin.

`actions/setup-node` and `oven-sh/setup-bun` install the repository's runtime pins
explicitly. The Ubuntu release does not select the Node or Bun version. Native
tool bindings and system utilities still run against the runner's OS libraries.
Before moving the baseline, run the complete `bun run verify` gate on the proposed
hosted image, including builds and isolated archive consumers, then update both
workflows and this guide together.

## Archive consumers

`pack:check` does not build packages. Run `bun run build` first when invoking it
outside `verify`. It packs each public package with `bun pm pack`, checks export
targets, required license files and resolved dependency protocols, then installs
the tarball outside the workspace with fresh consumer dependencies.

Consumers load every export with Bun and the pinned Node. The runner also checks
declared CommonJS exports and CLI help where present, and uses `tsc` with NodeNext
resolution for JavaScript exports. The generated declaration smoke check uses
`skipLibCheck: true`; focused consumer fixtures can enforce stricter public type
contracts.

Optional contracts live in `packages/<name>/tests/fixtures/consumer/`:

- `package.json` adds dependencies for the full consumer.
- `tsconfig.json` enables the fixture's declaration contract.
- `runtime.mjs` runs with both Bun and Node, including without a fixture tsconfig.
- `without-optional-peers.mjs` and `.ts` enable a separate consumer that omits
  optional peers and extra fixture dependencies. Its runtime runs on both
  runtimes; its type contract uses strict NodeNext with `skipLibCheck: false`.

These fixtures resolve installed tarballs, so source lint and Knip exclude them
from workspace resolution. Set `TOOLKIT_KEEP_PACK_CHECK=1` to retain disposable
consumer directories for diagnosis. Archive checks do not publish packages.

## Documentation site

```sh
bun run docs:dev      # http://localhost:3100
bun run docs:check
bun run docs:build
bun run docs:preview
```

Edit canonical Markdown, not generated copies. The private Fumadocs application
compiles root documentation and package READMEs directly, with page metadata and
navigation in `docs/src/lib/pages.ts` and content selection in
`docs/src/lib/source.ts`. Register new pages in both places. Registered Markdown
links become site routes; other repository files link to GitHub.

The build prerenders documentation and search. The site has no npm publication
and does not change library versions. See [site ownership](../AGENTS.md) and
[template provenance](../NOTICE.md).

## Adding a package

1. Add `packages/<name>` with its manifest, README, license, initial changelog and
   package instructions. Declare explicit public exports and supported engines.
   Keep reusable code independent of Raypx product workspaces and retain source
   provenance for adapted code.
2. Add a strict check, tests and a build suitable for the package. ESM libraries
   use explicit entries in `tsdown.config.ts`; configuration packages export
   package-root files. Prefer public entry files directly under `src/`, with
   supporting implementation modules in subdirectories.
3. Declare dependency ranges in the owning manifest and refresh `bun.lock`.
   Follow the [dependency policy](dependencies.md), including peer and bundled
   dependency rules.
4. Add the workspace to `knip.ts` and the expected package list in
   `tests/scripts/release-scope.test.ts`. `pack:check` discovers public packages
   automatically; add focused consumer fixtures when their types or runtime
   behavior need an installed-tarball contract.
5. Update the root package table, [documentation index](../README.md), repository
   ownership instructions and site registration. Run narrow checks, then
   `bun run verify`.

New packages start at `0.0.0-alpha.0`; their initial work belongs in the initial
changelog. Follow [version preparation](changesets.md) before the first
publication. Do not add fixed or linked Changesets version groups.
