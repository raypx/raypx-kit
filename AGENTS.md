# Raypx Kit Instructions

## Scope

This standalone repository publishes reusable `@raypx-kit/*` libraries. It must not
depend on the Raypx product repository, business schemas, repository interfaces,
application environment, or runtime scripts. Read the package's own `AGENTS.md`
and focused documentation before modifying it.

## Repository shape

`packages/codemods` owns the explicit-file migration runner and CLI;
`packages/drizzle` owns Drizzle extensions; `packages/env` owns typed environment
validation and reusable presets; `packages/intl` owns generic internationalization;
`packages/tsconfig` owns the published strict TypeScript presets;
`packages/devkit` owns reusable repository maintenance checks;
`packages/drizzle-kit` owns the slim upstream CLI distribution;
`packages/logger` owns evlog-based structured logging, wide events and Node
request context.
`packages/analytics` owns consent-controlled PostHog browser analytics and optional React bindings.
`packages/notifications` owns explicit Knock workflow clients, signed user tokens and optional React feeds.
`packages/security` owns Nosecone security headers and optional Arcjet request protection; applications supply keys and rules.
`packages/storage` owns object storage drivers and signed upload and download URLs.
`packages/email-preview` owns the React Email preview Vite plugin, template runtime and prebuilt interface.
`packages/themes` owns shared theme tokens, CSS, initialization and optional React theme state.
`packages/ui` owns reusable shadcn-style Base UI primitives and class utilities.
Root `docs/` is an internal Fumadocs application and owns
the documentation site alongside canonical reference Markdown. New libraries live under `packages/`
and have explicit ESM exports, a README, license, independent version and tests.
Configuration packages export their package-root files directly instead of `dist/`.
`pack:check` installs public archives in isolated Bun consumers and
loads JavaScript/JSON exports and resolves and reads exported CSS assets. Internal
runtime dependencies install from archives in the same verification batch;
package behavior and public types belong in unit tests.
Optional `packages/<name>/tests/fixtures/consumer` declaration contracts are copied into
the isolated archive consumer by `pack:check`. Their own tsconfig checks public
types against the installed tarball; they are excluded from source lint resolution.
An optional `runtime.mjs` in the same fixture runs against the installed archive
with Bun, including fixtures without a tsconfig. The separate Node workflow reuses
the same contracts on the supported Node versions.
Optional `without-optional-peers/runtime.mjs` and `without-optional-peers/types.ts`
contracts use a second isolated consumer that omits optional peers and extra
fixture dependencies. Runtime contracts run with the selected consumer runtime; type contracts use
strict NodeNext checks with `skipLibCheck: false`.
Every workspace's TypeScript configuration extends an `@raypx-kit/tsconfig` preset,
declared once by the internal root through `workspace:*`; VP task inputs include
the presets. Shared test configuration lives in root
`tests/config.ts`; it is not a published runtime dependency.
Keep unit and integration tests under their owning workspace's `tests/` directory,
and browser scenarios in a sibling `e2e/` directory. Repository
maintenance tests live in root `tests/scripts/`, mirroring the maintenance script
directories where applicable; shared test preloads live in `tests/setup/`, and
package fixtures in `tests/fixtures/`. Type checks include tests; library builds
include only `src/`. Keep Vitest configuration at each workspace root and import
the shared configuration from root `tests/config.ts`.

Keep the internal CLI at `scripts/cli.ts`. Group maintenance modules by their
responsibility under `scripts/checks/`, `scripts/packages/`, `scripts/release/`
`scripts/tasks/`, `scripts/verify/` and `scripts/ci/`; keep helpers shared by these scripts in `scripts/shared/`.
Use the directory for context instead of repeating that context in every filename.
Keep public package entry filenames and framework-recognized configuration names stable.

Prefer public TypeScript entry files directly under `src/`; keep supporting
implementation modules in subdirectories when useful.

Keep the root README as the project entry point and `docs/README.md` as the
documentation map. Repository architecture belongs in `docs/architecture/README.md`;
setup, dependency maintenance, versioning and publication belong in
`docs/development/`. Maintain capability inventories and extension designs in
`docs/<package>/`. Package READMEs are the canonical guides for shipped APIs and
link to repository design documents; research inventories are not npm payloads.
Keep commands and policies in their owning guide rather than repeating full
instructions across the root README, architecture guide and package guides.
The documentation site compiles canonical Markdown directly through Fumadocs.
Keep the documentation workspace internal and outside library release versions and archives.
Keep license texts and source notices alongside the package that ships adapted code.
Write canonical repository and package documentation in English. The documentation
site may keep maintained translations under `docs/content/`; preserve English
fallbacks, localized message examples, code identifiers and source links.

## Toolchain

Bun 1.4.4 is the development and default CI runtime. Root `packageManager` is the
single development pin; `devEngines`, mise, CI and documentation follow it. There
is no root Node pin. mise reads only Bun from package.json and has no `[tools]` pins.
Run `mise trust && mise install`, activate mise or use `mise exec -- <command>`.
`bun run doctor` checks the actual executable; `toolchain:check` rejects drift.

VP owns the only task graph, cache, formatting, linting, tests and builds. Root
`scripts/tasks/` reads workspace manifests and supplies plain `run.tasks` through
lightweight `vite.config.ts` files. Tasks use private `task:*` names, while package
scripts remain terminal leaf commands. `scripts/tasks/leaf.ts` forwards arguments
only to the selected task, and runtime/platform identity participates in commands.
Keep native Bun typechecker source inputs explicit across dependency workspaces;
filesystem tracing does not capture every native checker read. Cache real output
files, preserve build environment values and fingerprint outcome-affecting variables.
The private runner omits agent/job metadata: TanStack Start otherwise fingerprints
every environment key through its unrestricted `loadEnv` hook. Keep `CI` and
`GITHUB_ACTIONS` guards, credentials and application build inputs available.
Create ignored output directories before tracing to keep enumeration stable.
Do not introduce a second task runner.

Libraries build with `bun --bun vp pack`, using the `pack` block in their
`vite.config.ts`. Preserve ESM exports, declarations, sourcemaps, bundling rules
and the public Node compatibility floor. Drizzle Kit keeps its byte-for-byte
upstream extractor as its VP build leaf. TSConfig exports package-root JSON.
Apps use `bun --bun vp build`; application plugins live in `vite.app.config.ts`
so loading task metadata cannot start an application or import a built library.
Email Preview packs its plugin and builds its prebuilt interface through VP.
Themes generates package-root styles from tokens; UI scans its published dist.
Run local binaries with Bun (`bun --bun vp`, `bun run knip`, `bun run changeset`).

Public packages retain Node-compatible interfaces and existing `engines.node`
ranges; a Bun development toolchain is not permission to introduce Bun-only APIs
into their Node/universal exports. Library targets stay at `node22.21.0`. Independent
Node consumer tests run through `.github/workflows/node-compatibility.yml`, manually
or before npm publication, against exact archives and supported peer lower bounds.
`scripts/packages/node-version` selects that workflow's upper baseline, not a
repository development runtime. Node-only vendor tools (Cloudflare packaging and
npm transport) use the explicit `.github/actions/setup-node-tools` exception.
Default CI never installs Node through the repository setup action.

Documentation defaults to Nitro's Bun target for builds, previews and browser
verification. `docs:build:cloudflare` and `docs:deploy` explicitly select the Worker
target using the isolated Node vendor tools; the independent compatibility workflow
checks that build. Keep both targets working and never deploy a Bun server entry
as a Worker. Docs and browser tests consume built public package exports.

`devkit.config.ts` owns complete workspace metadata and source-entry mappings.
Repository maintenance imports this trusted configuration explicitly; discovery
never executes an inspected repository's configuration. Keep manifests free of
repository-only Devkit metadata. `scripts/checks/toolchain.ts` composes generic
Devkit declaration checks with installed dependency pairing and the narrow vendor
workflow exception. Preserve public Devkit Node/Bun checking APIs for consumers.

Use `bun --check --tsconfig-override tsconfig.json` for native type checks. VP pack
emits declarations; installed archive consumers also run strict NodeNext TypeScript
contracts with `skipLibCheck: false`. Keep direct third-party dependencies in their
owning manifests and internal dependencies on `workspace:*`.

## Dependency versions

Third-party dependency declarations use version ranges. Stable dependencies and
development dependencies use caret ranges from the latest compatible tested
release. Peer ranges describe supported consumer versions; do not narrow them
just to match the development install. Internal dependencies keep `workspace:*`.
Commit `bun.lock` and use frozen installation in CI for reproducible builds.

Preserve compatibility through constrained prerelease ranges and installed-version
checks in `bun run toolchain:check`:

- Vite+, its Vite core alias/override and coverage providers use caret ranges.
  The installed Vite+ and core versions must match, and installed coverage
  providers must match Vite+'s bundled Vitest version.
- `@fumadocs/base-ui` and `fumadocs-core` use caret ranges and must resolve to the
  same installed version.
- Drizzle ORM, CLI and consumer fixtures use
  `>=1.0.0-rc.5-5935859 <1.0.0-rc.5-z`, restricting resolution to the RC5 hash
  family. Test the lockfile's selected builds together before accepting an update.
  The slim CLI preserves upstream dependency names and existing ranges; exact
  upstream declarations become caret ranges that include the upstream version.
- Nitro uses the tested prerelease range `~3.0.260903-beta`.

The Bun runtime pin remains exact in `packageManager`. Node type declarations
follow the independent compatibility baseline; Bun types, when declared, start
at the Bun pin. Do not install a development Node runtime to run checks.

Range changes do not authorize upgrading copied source provenance or replacing
bundled dependencies outside their upstream compatibility ranges. Recheck
bundled versions and retained third-party licenses after updating the lockfile.

## Code and publication

Preserve the strict TypeScript presets, type-only imports, conditional optional
properties, and public API type declarations. Runtime dependencies must resolve
outside this repository. Drizzle remains a peer dependency and must never be
bundled or prototype-patched globally. Its extension package supports PostgreSQL
through postgres.js only; keep node-postgres and other drivers outside its scope.
Env keeps Zod as a peer dependency and never bundles it. Callers own variable names,
secrets, application presets and validation policy; keep generic runtime detection
independent of frameworks and product configuration.

Changesets versions every public package independently: leave `fixed` and
`linked` empty. The repository stays in Changesets `alpha` pre mode until an
explicitly approved first stable release; never run `changeset pre exit` without
that approval. New packages start at `0.0.0-alpha.0`; first publication uses that
manifest version without running `version-packages`. Initial work belongs in the initial
changelog; changesets increment versions for subsequent releases. Include a
changeset for user-visible changes after initial release preparation. Retain full upstream
licenses and pinned source provenance for copied or adapted code. UI, Themes,
Email Preview, Notifications and Security keep their own Apache license in `LICENSE`. Their READMEs contain
generated indexes of direct runtime and peer dependencies, recording installed
versions and license links. Maintain these indexes with `bun run licenses:update`;
`licenses:check` rejects drift before source verification. Ordinary external
dependencies carry their own full license texts; do not copy them into package
licenses. Preserve UI's complete shadcn MIT license and source notice, and Themes'
source notice. Email Preview generates complete notices for actually bundled
third-party modules in `dist/THIRD_PARTY_LICENSES.txt`; keep this build output out
of Git and include it in the published archive. Update package docs when exports
or compatibility guarantees change.

Do not publish to npm without direct authorization. `pack:check` builds local
tarballs and installs them in a disposable directory; it does not publish.
`release:plan` is read-only, `release:pack` replaces only `.changeset/pack/release/`,
and `release:publish` publishes; follow `docs/development/publishing.md`.
`release:snapshot` packs `0.0.0-next-*` consumer previews into `.changeset/pack/snapshot/`
and restores every manifest; only its `--publish` flag uploads them under `next`.
The CLI accepts release `--stable` and string `--otp <code>` flags directly,
after the final subcommand. Reject options before a subcommand rather than losing them.
Prefer `--` for additional Changesets arguments; retain direct forwarding for
existing publish invocations and preserve OTP leading zeros. Help after `--`
belongs to Changesets. Prefer the full `raypx-kit-dev release publish` command for
forwarding; Bun consumes a leading separator on the `release:publish` alias,
which needs `-- -- <Changesets args>` when no wrapper options precede it.
Automatic version PRs and npm publication are disabled independently in CI until
maintainers configure `VERSION_PR_ENABLED` and `NPM_PUBLISH_ENABLED`, respectively.
Version PRs also require the repository's Actions PR-creation permission.

## Verification

Run a changed package's narrow tests first, then `bun run verify --full` before
delivery. Daily `verify` selects affected workspaces from Git (including local
changes); unknown files or an unavailable base select full coverage. `--dry-run`
prints the exact plan. `verify:quick` runs source checks and affected unit suites.
All paths retain doctor, toolchain checks, licenses, architecture, formatting,
lint, Knip and strict types. Full verification additionally builds libraries/docs,
runs browser scenarios and validates archives and release preparation with Bun.

CI consumes the same plan. Source/tests/builds precede independent browser and
archive gates; those gates restore the newly saved VP build cache. PostgreSQL runs
in parallel only for relevant changes. The final `verify` job rejects failed,
missing or cancelled required gates and accepts skips only when unselected.
Shared workflow actions restore compatible VP artifacts and upload the cache only
when a new successful artifact exists. Node matrices live outside default CI.

Maintenance tests are uncached because they spawn independent VP runners; nested
filesystem tracing is unsupported on macOS. Preserve meaningful regression tests
for real cache hits, dependency invalidation, output restoration, changed-file
selection and CI result aggregation. Use two workspace task slots and one Vitest
worker by default. Documentation content invalidates docs, not unrelated libraries.

React workspaces own `e2e/` scenarios and installed public-export consumers; shared
runner/configuration live in root `e2e/` and Playwright configuration. Install the
Chromium shell with `bun run test:e2e:install --only-shell`. Browser failures remain
in ignored `.artifacts/e2e/`. Keep HTTP traffic local and test-owned; no live service
accounts or application credentials. Never replace a failing browser flow with a mock.

Generated evidence lives under `.artifacts/` and stays out of Git and archives.
Preserve failure exit codes; never upload dotenv files, credentials or consumer
installations. Default verification remains database-free. Real PostgreSQL tests
run only in their independent CI job with a temporary PostgreSQL 17 service and
`DRIZZLE_TEST_DATABASE_URL`; missing prerequisites fail rather than skip. Only that
job establishes PostgreSQL execution evidence. Preserve test-owned schemas, cleanup
and connection closure; do not expand the database/platform support matrix silently.

`bun run knip` checks workspace source files, dependency usage and internal
exports. Keep public library entry points as API roots, including APIs with no
workspace callers. Independent tarball consumer fixtures retain their own
manifests and installed-dependency environments; `pack:check` validates those
contracts without source aliases. Model framework entry points and dynamic
references explicitly. Keep any allowlist narrow and add a comment explaining
each exception; do not suppress whole categories of unused dependencies or
exports to make the check pass. Knip runs in the existing `verify` pipeline and
CI job.

Preserve unrelated user changes. Never reset files or rewrite Git history as
cleanup. Do not log credentials, authorization headers, tokens, or query secrets.
