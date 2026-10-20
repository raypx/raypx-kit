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

| Command                      | What it checks or runs                                           |
| ---------------------------- | ---------------------------------------------------------------- |
| `bun run lint`               | Vite+ formatting and lint checks                                 |
| `bun run format`             | Apply Vite+ formatting                                           |
| `bun run check`              | Root and workspace TypeScript checks                             |
| `bun run knip`               | Unused source files, dependencies and internal exports           |
| `bun run architecture:check` | Workspace imports, public source entries and platform boundaries |
| `bun run codemod list`       | List built-in migrations; the initial registry is empty          |
| `bun run test:toolchain`     | Root maintenance tests and documentation tests                   |
| `bun run test`               | Maintenance/documentation tests, then workspace tests            |
| `bun run build`              | Workspace checks and builds, including the documentation site    |
| `bun run pack:check`         | Pack current package output and check isolated archive consumers |
| `bun run release:check`      | Changesets versioning rules in disposable local fixtures         |
| `bun run verify`             | The complete local gate, also used by CI                         |

Start with the affected package's narrow checks:

```sh
bun run --cwd packages/drizzle check
bun run --cwd packages/drizzle test
bun run build --filter=@raypx-kit/drizzle
```

`verify` runs runtime and declaration checks, workspace architecture, lint, types,
Knip, maintenance tests, workspace tests and builds, archive consumers, then
Changesets fixtures. Its four phases (`verify:toolchain`, `verify:source`,
`verify:tests`, `verify:artifacts`) also provide the named CI steps. CI adds an
archive compatibility matrix and an independent Drizzle database integration job. Local
`verify`, default unit tests, coverage and tarball checks do not require a database;
the normal gate does not enable coverage. Run a package's `test:coverage` after
changing its test runtime or coverage provider.

## Tool and test boundaries

Bun owns installation and script orchestration. Turbo schedules workspace tasks;
`build` depends on that workspace's `check` and dependency builds. Vite+ owns
formatting, linting, tests and the documentation application's Vite commands.
tsdown builds the six ESM packages and their declarations. Drizzle Kit copies
upstream artifacts through its extractor; TSConfig publishes its JSON presets
directly.

Package scripts invoke `turbo`, `tsdown`, `changeset`, `knip`, `vp check` and
`vp fmt` directly. Tests retain `bun --bun vp` because workers use Bun-specific
flags and the Intl jsdom preload. The documentation development server also uses
`bun --bun vp` with Nitro's Bun preset. Its build and preview invoke `vp` directly
so Wrangler runs with Node and serves the production Cloudflare Worker.
Repository TypeScript scripts, native type checks and archive
packing use Bun explicitly.

Workspace checks use `bun --check --tsconfig-override tsconfig.json` without a
source entrypoint. This invokes Bun's native type checker rather than resolving
the `check` package script. Every workspace extends an `@raypx-kit/tsconfig`
preset; the internal root declares this shared workspace dependency.

Keep tests under each workspace's `tests/`. Root maintenance tests live in
`tests/scripts/`, documentation tests in `docs/tests/`, and shared preloads in
`tests/setup/`. Maintenance scripts are grouped by responsibility in
`scripts/checks/`, `scripts/packages/`, `scripts/release/` and `scripts/ci/`, with
the command entry at `scripts/cli.ts`. Root script tests mirror these directories
where applicable. Use the directory for context instead of repeating it in
filenames; keep public package entries and framework configuration names stable.
Package `vitest.config.ts` files import `workspaceTests` from root
`tests/config.ts`. Type checks include tests; library build configs include only
`src/`.

Knip reads public library roots from the explicit tsdown entries, so an API does
not need a workspace caller to remain public. It also models maintenance scripts,
framework routes and configuration entries. Keep exceptions in `knip.ts` narrow
and explain the dynamic usage; do not make every source file an entry to suppress
findings.

## Repository check configuration

[devkit.config.ts](../../devkit.config.ts) is the typed source of repository
checking policy. Its `workspaces` map contains all nine workspace paths, with
their kind, platform, per-entry platform overrides, explicit source entries for
generated exports and bundled dependency exceptions. Keys are repository-relative
paths such as `packages/env`, without `./` or a trailing slash. Its `toolchain`
section lists documents whose runtime mentions must match the pins, and required
Turbo global dependencies.

Maintenance scripts explicitly import this file and pass its data to Devkit.
`discover(root, { metadata: config.workspaces })` stays synchronous and never
loads an inspected repository's configuration. The supplied map must cover every
discovered workspace exactly; missing or unknown paths fail, and package manifest
metadata cannot fill gaps. This repository keeps no `devkit` fields in workspace
manifests. Devkit's default `metadataKey` interface remains available for other
consumers. Root type checking and Turbo cache keys include the configuration.

`architecture:check` inspects source imports before building and rejects circular
workspace dependencies, internal cross-workspace imports, undeclared runtime
imports and incompatible platform APIs. A bundled dependency exception must also
be declared in the workspace's `devDependencies` and actually bundled by its build.
Extracted upstream CLI payloads retain their separate archive checks. See
[Devkit's metadata contract](../../packages/devkit/README.md#workspace-architecture).

Keep exports, dependencies and supported runtime ranges in the owning manifest;
keep the development Node pin in `.nvmrc` and the Bun pin in root `packageManager`.
The configuration references those declarations through checks rather than
duplicating their values.

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

Each job checks out its source and calls `.github/actions/setup-toolchain` to
install the pinned runtimes and locked dependencies. The publication job supplies
its npm registry URL; checkout history, permissions and verification steps belong
to the calling workflow. Toolchain declaration checks inspect both workflow steps
and the local composite actions.

The setup action caches Bun downloads under the runner's temporary directory and
sets `BUN_INSTALL_CACHE_DIR` for the rest of the job, including isolated consumer
installations. Cache keys include the OS, architecture, Bun version and lockfile
hash; a fallback reuses downloads from the same Bun version. Every job still runs
`bun install --frozen-lockfile --ignore-scripts`, including on a cache hit.

## CI diagnostics

CI runs the four verification phases as named steps. Each command records its
exit status, elapsed time and sanitized output under `.artifacts/ci/diagnostics/`;
a failed command still fails its step and job. All CI and release jobs have
explicit execution limits. Job summaries list completed stages and available
test counts, including failures and interrupted stages.

Tests retain their usual console reporter and write a JUnit report at each
workspace's `.artifacts/junit.xml`. Turbo restores the report with cached test
results. Local reports remain ignored files; CI collects sanitized reports into
the diagnostics directory. On failure, CI uploads only those diagnostics with a
seven-day retention period; dotenv files, credentials and installed consumer
directories are excluded. These generated directories are ignored by Git.

Every job calls `.github/actions/report-diagnostics` with `if: always()`, its
original `job.status` and a unique artifact name. The action generates the summary
for that status and uploads sanitized diagnostics if the job or summary fails.
Verification phases remain separate named workflow steps.

## CI database integration

Drizzle's real database integration suite runs only in a separate CI job, using a
temporary PostgreSQL 17 service. That job runs
`bun run --cwd packages/drizzle test:integration` with
`DRIZZLE_TEST_DATABASE_URL` pointing to its test database. The command requires
both CI and the URL and fails explicitly when either is missing; it does not
silently skip. Local setup and `bun run verify` have no database prerequisite.

The suite is configured to cover real JSONB expressions and decoding, UPSERT,
SQLSTATE error metadata and EXPLAIN through postgres.js. Test fixtures create
only test-owned schemas and tables, clean them up and close connections. Product
schemas, migrations and credentials are outside this job.

Only a successful Drizzle integration job provides evidence of real PG17
execution. Passing local `verify` does not include that evidence. PostgreSQL 18
is outside the test matrix; future version-specific features require their own
verification evidence.

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
- `without-optional-peers/runtime.mjs` and `without-optional-peers/types.ts`
  enable a separate consumer that omits optional peers and extra fixture
  dependencies. Its runtime runs on both runtimes; its type contract uses strict
  NodeNext with `skipLibCheck: false`.

These fixtures resolve installed tarballs, so source lint and Knip exclude them
from workspace resolution. Set `TOOLKIT_KEEP_PACK_CHECK=1` to retain disposable
consumer directories for diagnosis. Archive checks do not publish packages.

## Consumer compatibility matrix

The verification job prepares eight archives from its completed build and records
their SHA-256 digests and dependency profiles. The compatibility jobs download
those archives and verify the digests before installing them outside the
workspace. They retain the pinned development runtimes for orchestration and
type checking, and use a separate, checksum-verified Node binary for consumer
runtime checks. The development `doctor` requirement remains unchanged.

Every public package declares Node `>=22.14` support. Each package runs on the
exact minimum version (`22.14.0`) and on the development Node pin. The matrix
therefore contains four cells, with two independent dependency profiles for each
runtime:

- `minimum` installs exact peer lower bounds, including the admitted Drizzle
  prerelease lower bound.
- `current` installs exact versions from the frozen workspace installation,
  checked against `bun.lock`; it does not select a newly published peer release.

The matrix reuses export loading, supported CommonJS loading, CLI help, runtime
fixtures and strict declaration contracts. Drizzle's separate consumer without
optional peers also runs on each selected runtime. Compilation uses the pinned
Bun and compiler; the selected Node binary executes the JavaScript consumers.
These jobs do not connect to a database or publish packages.

To reproduce a matrix cell after building, keep the development Node on `PATH`
and select a separate Node executable:

```sh
bun run compatibility:check prepare --artifacts .artifacts/compatibility
bun run compatibility:check matrix --artifacts .artifacts/compatibility
bun run compatibility:check check --artifacts .artifacts/compatibility \
  --node /path/to/node --expected-node 22.14.0 --peers minimum
```

The selected binary must match its exact declared matrix version. Compatibility
testing remains separate from local `verify` so routine development does not
download extra runtimes or depend on a database.

## Documentation site

```sh
bun run docs:dev      # http://localhost:3100
bun run docs:check
bun run docs:build
bun run docs:preview
```

Edit canonical Markdown, not generated copies. The internal Fumadocs application
compiles root documentation and package READMEs directly, with page metadata and
navigation in `docs/src/lib/pages.ts` and content selection in
`docs/src/lib/source.ts`. Register new pages in both places. Registered Markdown
links become site routes; other repository files link to GitHub.

The build prerenders documentation pages and bundles a search API. The site has no npm publication
and does not change library versions. See [site ownership](../AGENTS.md) and
[template provenance](../NOTICE.md).

### Cloudflare deployment

Nitro's `cloudflare_module` preset builds the documentation Worker in
`docs/.output/server`, with prerendered pages and browser assets in
`docs/.output/public`. Root `wrangler.jsonc` names the Worker `raypx-kit-docs`,
binds its static assets as `ASSETS` and routes `/api/*` through the Worker first.
HTML routes use URLs without trailing slashes.

The TanStack Start file route `docs/src/routes/api/search.ts` handles
`GET /api/search?query=...` with Fumadocs' `GET` handler. The search dialog uses
`useFetchSearch` to fetch results instead of downloading the complete index.
The search endpoint is not prerendered and needs no static response header override.

Cloudflare Workers Builds owns automatic deployment through the repository's
Git integration. Configure the Worker's **Settings → Builds** with:

| Setting           | Value                 |
| ----------------- | --------------------- |
| Worker name       | `raypx-kit-docs`      |
| Root directory    | `/`                   |
| Production branch | `canary`              |
| Build command     | `bun run docs:build`  |
| Deploy command    | `bun run docs:deploy` |

Cloudflare manages the deployment credentials. GitHub Actions runs source,
test, documentation build, archive, compatibility and PostgreSQL integration
checks without uploading or deploying the documentation output. It needs no
Cloudflare Actions secrets or deployment environment. Cloudflare builds and
deployments run independently of these GitHub checks.

A custom domain can be configured in the Worker's Cloudflare settings.

For a local deployment, authenticate with `bunx wrangler login`, then run:

```sh
bun run docs:build
bun run docs:deploy
```

Validate the deployment configuration without publishing:

```sh
bun run docs:deploy --dry-run --outdir .artifacts/docs-deploy
```

See Nitro's [Cloudflare deployment guide](https://nitro.build/deploy/providers/cloudflare),
Cloudflare's [static assets routing guide](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
and [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/).

## Adding a package

1. Add `packages/<name>` with its manifest, README, license, initial changelog and
   package instructions. Declare explicit public exports and supported engines.
   Add its workspace path to root `devkit.config.ts`, including architecture
   metadata and source mappings for built exports.
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
   `tests/scripts/release/scope.test.ts`. `pack:check` discovers public packages
   automatically; add focused consumer fixtures when their types or runtime
   behavior need an installed-tarball contract.
5. Update the root package table, [documentation index](../README.md), repository
   ownership instructions and site registration. Run narrow checks, then
   `bun run verify`.

New packages start at `0.0.0-alpha.0`; their initial work belongs in the initial
changelog. Follow [version preparation](changesets.md) before the first
publication. Do not add fixed or linked Changesets version groups.
