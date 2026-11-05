# Development

The root workspace is private. Libraries under `packages/` own independent public
versions and explicit ESM exports; `docs/` is an internal documentation application.

## Setup

Use Node **22.22.2** and pnpm **12.16.1**, pinned in root `engines.node` and
`packageManager`. mise reads the Node pin; install the pinned pnpm separately:

```sh
mise trust && mise install
mise exec -- npm install --global pnpm@12.16.1
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm run doctor
```

Activate mise in your shell, or prefix commands with `mise exec --`. Development,
checks, builds, browser runners and default CI use Node. Public package Node APIs
and engine ranges remain compatible; their independent tests are described below.
The shared setup action installs pinned Node and pnpm.

## Daily commands

```sh
pnpm run verify                 # affected workspaces and consumers
pnpm run verify --dry-run       # review the selected tasks and gates
pnpm run verify --full          # complete Node gate before delivery
pnpm run verify:quick           # source checks and affected unit tests
pnpm run build
pnpm run build --filter=@raypx-kit/intl
pnpm run test --filter=@raypx-kit/devkit
pnpm run check
pnpm run licenses:check
pnpm run docs:dev
```

`verify` includes local staged, unstaged and untracked files. A missing Git base,
shared tooling/configuration change or unknown input selects full coverage.
`--base <ref>` selects a different comparison base. Documentation changes build
and test the documentation site; unrelated libraries and PostgreSQL are skipped.
Published README/license changes also validate that package's archive payload.

`verify:quick` keeps source checks and selects each affected workspace's `test:unit`
script, falling back to `test` when no separate unit script exists. It skips
standalone builds, browser, archive and release gates; dependency builds needed by
the selected tests still run. Combine `--quick --full` to check every workspace
with this reduced scope. `pnpm run verify:quick --dry-run` prints the quick plan,
including source checks and excluding the skipped gates. Task prerequisites remain
part of the VP graph shown by `pnpm exec vp run --last-details`.

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
pnpm run test --filter=@raypx-kit/intl -- --testNamePattern locale
pnpm exec tsx scripts/tasks/run.ts '@raypx-kit/intl#build' --dry-run
pnpm exec vp run --last-details
```

VP caches successful tasks in `node_modules/.vite/task-cache`, including build
outputs and JUnit reports. Source edits in a workspace dependency invalidate its
consumers. Source inputs include dependency workspaces explicitly. Task commands include runtime/platform
identity; environment inputs and private task arguments are fingerprinted. Shared Devkit Start environment loading tracks dotenv keys and Vite inputs while
preserving inherited environment values. Keep
the cache between runs. Maintenance tests spawn independent VP runners and stay
uncached, avoiding nested filesystem tracing on macOS.

## Tool and test boundaries

VP owns lint, format, Vitest, library packing and application builds. Libraries
use `pnpm exec vp pack`; Drizzle Kit retains its unchanged upstream file extractor.
Use `pnpm exec vp build` for apps. Configuration packages export package-root JSON.
Strict types use `tsc --noEmit --project tsconfig.json`; VP pack emits
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

Node and pnpm versions come from root `engines.node` and `packageManager`. The toolchain check enforces mise,
devEngines, CI and documentation consistency, and checks installed Vite+/core,
Vitest coverage and Fumadocs pairings. The shared setup also supplies Cloudflare packaging and npm transport.

## CI runner baseline

GitHub uses Ubuntu 24.04 and the same affected-workspace planner as local verification.
The plan selects JavaScript, browser, archive and PostgreSQL gates. Source checks,
tests and builds run once; browser and archive jobs then run independently and
restore those VP artifacts. PostgreSQL runs in parallel only when relevant.
The final `verify` check rejects failed, missing or cancelled required jobs and
permits skips only for unselected gates.

Shared actions cache pnpm downloads and VP artifacts. Every job performs a frozen
install; cached downloads never replace dependency verification. VP cache uploads
occur only when new successful artifact identities appear, avoiding uploads caused
by cache database timestamps. Browser downloads use the pinned Playwright revision;
CI installs system libraries only when one is missing.

## Browser E2E by workspace

```sh
pnpm run test:e2e:install --only-shell
pnpm run test:e2e
pnpm run test:e2e --project docs
pnpm run test:e2e --project intl --project themes
```

The runner builds prerequisites, checks and lints browser consumer sources, then
runs Playwright with Node against real built public exports. Artifacts and failures
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
generated from installed runtime/peer dependencies by `pnpm run licenses:update`;
`licenses:check` rejects drift. Email Preview's build also emits complete notices
for bundled modules into its archive. Ordinary external dependencies carry their
own license texts; never replace or truncate copied upstream notices.

## Archive consumers

`pack:check` does not build first. Outside verification, run `pnpm run build` before
`pnpm run pack:check`. pnpm packs public archives and checks export targets, metadata,
legal files and resolved dependency protocols, then installs them outside this
checkout. Internal runtime dependencies resolve from the same archive batch.
Affected verification selects consumer checks only for relevant public packages.

Optional `tests/fixtures/consumer/` contracts can add dependencies, a strict
`tsconfig.json`, `runtime.mjs`, or `without-optional-peers/` runtime and type
contracts. Default checks execute these with Node; the independent Node workflow
uses the same fixtures on its target runtime. CSS exports must resolve and contain
actual data. Retain consumer failures with `TOOLKIT_KEEP_PACK_CHECK=1` when debugging.
Packing and verification do not publish anything.

## Consumer compatibility matrix

Public packages retain their Node engine ranges and build targets. Node validation
lives in `.github/workflows/node-compatibility.yml`, invoked manually or before npm
publication. It is outside the default Node CI path. Its current upper baseline is
stored in `scripts/packages/node-version`; engine lower bounds come from each
public manifest. Minimum and locked peer profiles retain exact tested versions.
The workflow also validates the explicit Cloudflare documentation build.

Preparation records archive SHA-256 digests and dependency profiles. Matrix jobs
verify those digests, install the exact archives with pnpm and execute public exports,
CLI and runtime fixtures with the isolated Node binary. Compiler checks remain
strict NodeNext contracts. Node binaries are checksum-verified independently;
changing the consumer baseline never changes the Node development pin.

```sh
pnpm run build --filter=./packages/*
pnpm exec tsx scripts/packages/compatibility.ts prepare --artifacts .artifacts/compatibility
pnpm exec tsx scripts/packages/compatibility.ts matrix --artifacts .artifacts/compatibility
```

Use `compatibility.ts check --artifacts <directory> --node <binary>
--expected-node <version> --peers minimum|current` to reproduce a cell.

## Documentation site

```sh
pnpm run docs:dev
pnpm run docs:check
pnpm run docs:build
pnpm run docs:preview
```

Default builds and previews use Nitro's node-server target, including prerendering, SSR and
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
before uploading; it never uploads a Node server entry as a Worker. The independent
Node workflow validates this build without deployment credentials.

Cloudflare Workers Builds owns automatic deployment. Recommended settings are:

| Setting           | Value                          |
| ----------------- | ------------------------------ |
| Worker name       | raypx-kit-docs                 |
| Root directory    | /                              |
| Production branch | canary                         |
| Build command     | pnpm run docs:build:cloudflare |
| Deploy command    | pnpm run docs:deploy           |

Existing integrations using `docs:build` still get a correct Worker because the
deploy script builds the explicit target. Updating the build setting avoids an
extra Node build. Wrangler's direct custom build hook selects Cloudflare too; dev
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
