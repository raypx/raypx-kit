# Development

The root workspace is private. Libraries under `packages/` own independent public
versions and explicit ESM exports; `docs/` is an internal documentation application.

## Setup

Use Bun **1.4.4**, pinned once in root `packageManager`. mise reads that source:

```sh
mise trust && mise install
mise exec -- bun install --frozen-lockfile
mise exec -- bun run doctor
```

Activate mise in your shell, or prefix commands with `mise exec --`. Development,
checks, builds, browser runners and default CI use Bun. Public package Node APIs
and engine ranges remain compatible; their independent tests are described below.
The default setup action installs no Node runtime.

## Daily commands

```sh
bun run verify                 # affected workspaces and consumers
bun run verify --dry-run       # review the selected tasks and gates
bun run verify --full          # complete Bun gate before delivery
bun run verify:quick           # source checks and affected unit tests
bun run build
bun run build --filter=@raypx-kit/intl
bun run test --filter=@raypx-kit/devkit
bun run check
bun run licenses:check
bun run docs:dev
```

`verify` includes local staged, unstaged and untracked files. A missing Git base,
shared tooling/configuration change or unknown input selects full coverage.
`--base <ref>` selects a different comparison base. Documentation changes build
and test the documentation site; unrelated libraries and PostgreSQL are skipped.
Published README/license changes also validate that package's archive payload.

### Daily feedback and machine load

VP is the only task runner. Devkit owns the shared model, task argument handling,
configuration projection, Git change reader and dependency propagation engine. `scripts/tasks/` derives private `task:*` definitions
from workspace manifests; lightweight `vite.config.ts` files register them.
Application plugins live in `vite.app.config.ts`; library configuration lives in
`vite.config.ts` under `pack`. Package scripts remain direct leaf commands.

Two workspace tasks run concurrently by default, with one Vitest worker per task.
Set `VP_RUN_CONCURRENCY_LIMIT=1` or pass `--concurrency-limit=1` for lower load.
Root and package tests use the same suites. Forward task-specific arguments after
`--`; only matching leaf tasks receive them and dependency cache keys stay stable:

```sh
bun run test --filter=@raypx-kit/intl -- --testNamePattern locale
bun scripts/tasks/run.ts '@raypx-kit/intl#build' --dry-run
bun --bun vp run --last-details
```

VP caches successful tasks in `node_modules/.vite/task-cache`, including build
outputs and JUnit reports. Source edits in a workspace dependency invalidate its
consumers. Native Bun typechecker source inputs are explicit because filesystem
tracing does not observe every native read. Task commands include runtime/platform
identity; environment inputs and private task arguments are fingerprinted. Shared Devkit Start environment loading tracks dotenv keys and Vite inputs while
preserving inherited environment values. Keep
the cache between runs. Maintenance tests spawn independent VP runners and stay
uncached, avoiding nested filesystem tracing on macOS.

## Tool and test boundaries

VP owns lint, format, Vitest, library packing and application builds. Libraries
use `bun --bun vp pack`; Drizzle Kit retains its unchanged upstream file extractor.
Use `bun --bun vp build` for apps. Configuration packages export package-root JSON.
Strict types use `bun --check --tsconfig-override tsconfig.json`; VP pack emits
declarations, and installed archive consumers also run TypeScript contracts.

Tests live under the owning workspace's `tests/`; browser scenarios belong in
its sibling `e2e/`. Shared defaults are in root `tests/config.ts`. Tests remain
independent of application plugins, live databases, mail or service accounts.

## Repository check configuration

`devkit.config.ts` owns complete workspace metadata, platform constraints and public
source-entry mappings. Maintenance scripts import it explicitly; package discovery
never executes an inspected repository's configuration. Keep repository metadata
out of published manifests. Knip uses these same source mappings as public API
roots, retaining exports even when this repository has no caller.

Bun's version comes only from `packageManager`. The toolchain check enforces mise,
devEngines, CI and documentation consistency, and checks installed Vite+/core,
Vitest coverage and Fumadocs pairings. Node-only vendor tooling has one narrow
setup action, separate from the default Bun setup.

## CI runner baseline

GitHub uses Ubuntu 24.04 and the same affected-workspace planner as local verification.
The plan selects JavaScript, browser, archive and PostgreSQL gates. Source checks,
tests and builds run once; browser and archive jobs then run independently and
restore those VP artifacts. PostgreSQL runs in parallel only when relevant.
The final `verify` check rejects failed, missing or cancelled required jobs and
permits skips only for unselected gates.

Shared actions cache Bun downloads and VP artifacts. Every job performs a frozen
install; cached downloads never replace dependency verification. VP cache uploads
occur only when new successful artifact identities appear, avoiding uploads caused
by cache database timestamps. Browser downloads use the pinned Playwright revision;
CI installs system libraries only when one is missing.

## Browser E2E by workspace

```sh
bun run test:e2e:install --only-shell
bun run test:e2e
bun run test:e2e --project docs
bun run test:e2e --project intl --project themes
```

The runner builds prerequisites, checks and lints browser consumer sources, then
runs Playwright with Bun against real built public exports. Artifacts and failures
live under `.artifacts/e2e/`. Tests own local services and synthetic inputs; do not
substitute a mock for a failing browser flow. Local verification does not establish
PostgreSQL or unrun-platform evidence.

## CI diagnostics

`scripts/ci/diagnostics.ts` records phase timing and failures without changing exit
codes. The reporting action retains ignored `.artifacts/` evidence for failed jobs.
Do not upload environment files, credentials or entire consumer installations.

## CI database integration

Drizzle's real database suite runs only in GitHub Actions with an isolated
PostgreSQL 17 service and `DRIZZLE_TEST_DATABASE_URL`. Default local verification,
unit tests, coverage and archive checks are database-free. Missing explicit
integration prerequisites fail rather than silently skipping tests. Keep fixtures
inside owned temporary schemas, clean them up and close all connections.

## Dependency license records

UI, Themes, Email Preview, Notifications and Security retain their own Apache
licenses, source provenance and complete notices. README dependency indexes are
generated from installed runtime/peer dependencies by `bun run licenses:update`;
`licenses:check` rejects drift. Email Preview's build also emits complete notices
for bundled modules into its archive. Ordinary external dependencies carry their
own license texts; never replace or truncate copied upstream notices.

## Archive consumers

`pack:check` does not build first. Outside verification, run `bun run build` before
`bun run pack:check`. Bun packs public archives and checks export targets, metadata,
legal files and resolved dependency protocols, then installs them outside this
checkout. Internal runtime dependencies resolve from the same archive batch.
Affected verification selects consumer checks only for relevant public packages.

Optional `tests/fixtures/consumer/` contracts can add dependencies, a strict
`tsconfig.json`, `runtime.mjs`, or `without-optional-peers/` runtime and type
contracts. Default checks execute these with Bun; the independent Node workflow
uses the same fixtures on its target runtime. CSS exports must resolve and contain
actual data. Retain consumer failures with `TOOLKIT_KEEP_PACK_CHECK=1` when debugging.
Packing and verification do not publish anything.

## Consumer compatibility matrix

Public packages retain their Node engine ranges and build targets. Node validation
lives in `.github/workflows/node-compatibility.yml`, invoked manually or before npm
publication. It is outside the default Bun CI path. Its current upper baseline is
stored in `scripts/packages/node-version`; engine lower bounds come from each
public manifest. Minimum and locked peer profiles retain exact tested versions.
The workflow also validates the explicit Cloudflare documentation build.

Preparation records archive SHA-256 digests and dependency profiles. Matrix jobs
verify those digests, install the exact archives with Bun and execute public exports,
CLI and runtime fixtures with the isolated Node binary. Compiler checks remain
strict NodeNext contracts. Node binaries are checksum-verified independently;
changing the consumer baseline never changes the Bun development pin.

```sh
bun run build --filter=./packages/*
bun scripts/packages/compatibility.ts prepare --artifacts .artifacts/compatibility
bun scripts/packages/compatibility.ts matrix --artifacts .artifacts/compatibility
```

Use `compatibility.ts check --artifacts <directory> --node <binary>
--expected-node <version> --peers minimum|current` to reproduce a cell.

## Documentation site

```sh
bun run docs:dev
bun run docs:check
bun run docs:build
bun run docs:preview
```

Default builds and previews use Nitro's Bun target, including prerendering, SSR and
the locale-filtered search API. Fumadocs compiles canonical Markdown directly;
register pages in `docs/src/lib/pages.ts` and content in `docs/src/lib/source.ts`.
Application plugins live in `docs/vite.app.config.ts`. Docs never publish to npm or
advance library versions. See [site ownership](../AGENTS.md) and [provenance](../NOTICE.md).

Use the [documentation authoring guide](documentation.md) for file trees, callouts,
opt-in steps and code tabs, including rendered examples of each Fumadocs plugin.

### Cloudflare deployment

The explicit `docs:build:cloudflare` command uses the separate Node vendor baseline
and Nitro's `cloudflare_module` target. Root `wrangler.jsonc` selects its Worker
entry, static assets and search API routing. `docs:deploy` always builds this target
before uploading; it never uploads a Bun server entry as a Worker. The independent
Node workflow validates this build without deployment credentials.

Cloudflare Workers Builds owns automatic deployment. Recommended settings are:

| Setting           | Value                         |
| ----------------- | ----------------------------- |
| Worker name       | raypx-kit-docs                |
| Root directory    | /                             |
| Production branch | canary                        |
| Build command     | bun run docs:build:cloudflare |
| Deploy command    | bun run docs:deploy           |

Existing integrations using `docs:build` still get a correct Worker because the
deploy script builds the explicit target. Updating the build setting avoids an
extra Bun build. Wrangler's direct custom build hook selects Cloudflare too; dev
previews and an already-built deploy skip that hook to avoid recursion. Cloudflare
owns its own credentials. GitHub source, browser and compatibility checks never
upload documentation or require Cloudflare application secrets.

## Adding a package

Create an independently scoped ESM package with explicit public exports, README,
license, tests and metadata in `devkit.config.ts`. Declare third-party dependencies
in the owning manifest and internal dependencies with `workspace:*`. Add its public
entry mapping, platform constraints and independent VP configuration. Libraries
put packing options under `pack`; apps keep plugins in `vite.app.config.ts`.
React packages also own an E2E project using built public exports. Do not introduce
product schemas, secrets or a dependency on the Raypx application repository.
Follow the [Changesets guide](changesets.md) and [publishing runbook](publishing.md)
when a public release is required.
