# Raypx Kit Instructions

## Scope

This standalone repository publishes reusable `@raypx-kit/*` libraries. It must not
depend on the Raypx product repository, business schemas, repository interfaces,
application environment, or runtime scripts. Read the package's own `AGENTS.md`
and focused documentation before modifying it.

## Repository shape

`packages/drizzle` owns Drizzle extensions; `packages/env` owns typed environment
validation and reusable presets; `packages/intl` owns generic internationalization;
`packages/tsconfig` owns the published strict TypeScript presets;
`packages/devkit` owns reusable repository maintenance checks;
`packages/drizzle-kit` owns the slim upstream CLI distribution;
`packages/logger` owns evlog-based structured logging, wide events and Node
request context.
Root `docs/` is a private Fumadocs application and owns
the documentation site alongside canonical reference Markdown. New libraries live under `packages/`
and have explicit ESM exports, a README, license, independent version and tests.
Configuration packages export their package-root files directly instead of `dist/`.
`pack:check` installs every public archive in isolated Bun and Node consumers and
loads each export; package behavior and public types belong in unit tests.
Optional `packages/<name>/tests/fixtures/consumer` declaration contracts are copied into
the isolated archive consumer by `pack:check`. Their own tsconfig checks public
types against the installed tarball; they are excluded from source lint resolution.
An optional `runtime.mjs` in the same fixture runs against the installed archive
with both Bun and the pinned Node, including fixtures without a tsconfig.
Optional `without-optional-peers.mjs` and `.ts` contracts use a second isolated
consumer that omits optional peers and extra fixture dependencies. Runtime
contracts run with Bun and Node; type contracts use strict NodeNext checks with
`skipLibCheck: false`.
Every workspace's TypeScript configuration extends an `@raypx-kit/tsconfig` preset,
declared once by the private root through `workspace:*`; Turbo's global
dependencies include the presets. Shared test configuration lives at the root; it
is not a published runtime dependency.
Keep every test under its owning workspace's `tests/` directory. Repository
maintenance tests live in root `tests/scripts/`, shared test preloads in
`tests/setup/`, and package fixtures in `tests/fixtures/`. Type checks include
tests; library builds include only `src/`. Keep Vitest configuration at each
workspace root and the shared configuration in root `test.config.ts`.

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
Keep the site private and outside library release versions and archives.
Keep license texts and source notices alongside the package that ships adapted code.
Write repository and package documentation in English. Keep localized message
examples in their intended languages and preserve code identifiers and source links.

## Toolchain

Use Bun 1.4.3 and Node 24.22.0 for repository development. `.nvmrc` is the
authoritative Node pin; the root `packageManager` is the authoritative Bun pin.
Keep `engines`, `devEngines`, CI setup and documented versions consistent with
those sources through `bun run toolchain:check`. Public package Node compatibility
ranges are independent of the repository development pin.

mise is the recommended version manager. Its configuration only enables reading
the two pins and must not add `[tools]` versions. Run `mise trust && mise install`,
then activate mise in the shell or use `mise exec -- <command>`. Other version
managers may select the same pins. `bun run doctor` checks the active executables.

Install dependencies before invoking the repository CLI. The root `raypx-kit-dev`
script runs `bun scripts/cli.ts` using citty. Keep `doctor`,
`toolchain:check` and `release:plan`, `release:pack`, `release:publish`,
`release:snapshot` as aliases.
Toolchain declaration checks come from `packages/devkit` (which parses TOML and
YAML with confbox). `scripts/toolchain.ts` composes those checks with this
repository's installed dependency checks from `scripts/check-dependencies.ts`.
Retain the existing process and output helpers. These private maintenance tools
do not change published package APIs.

Bun owns installation and repository scripts. Turbo owns task orchestration.
Vite+ owns formatting, linting, tests and the documentation application's Vite
commands. Direct tsdown builds Devkit, Drizzle, Env, Intl and Logger, including
their declarations, from each package's `tsdown.config.ts`; its dependency range
starts at `^0.23.1`. Drizzle Kit retains its upstream extractor, and TSConfig
exports its JSON presets directly. Package scripts invoke local `turbo`,
`tsdown`, `changeset`, `knip`, `vp check` and `vp fmt` commands directly; these
follow their Node shebangs. Keep `bun --bun vp` for tests because their workers
use Bun-specific flags and the Intl jsdom preload. The private documentation
site also retains `bun --bun vp` development/build/preview commands: its Nitro
`bun` preset produces server code that requires Bun during prerendering.
Repository TypeScript maintenance scripts, native type checking and archive
packing continue to use Bun explicitly. Node and npm 10.9+ are also needed for
packaged consumer checks and registry publication.

Use `bun --check --tsconfig-override tsconfig.json` for workspace type checks.
The flag invokes Bun's native checker without resolving the `check` package script;
keep it free of source entrypoints so it only checks types. tsdown generates
library declarations, and isolated package consumers retain their `tsc` check.

Declare third-party dependency versions directly in the owning `package.json`.
Internal dependencies use `workspace:*`. Releases pack every archive with
`bun pm pack`, which resolves `workspace:` and `catalog:` protocols; never publish
with plain `changeset publish` or `npm publish <directory>`, which pack this Bun
workspace with npm and publish those protocols verbatim. The root Vite override
keeps plugins on Vite+'s bundled core. Do not add a second formatter or linter. Each
test-bearing package keeps its own `vitest.config.ts`, importing `workspaceTests`
from root `test.config.ts`. Do not import application test preloads.
Installed coverage providers must resolve to the same version as Vite+'s bundled
Vitest. Verify coverage commands when updating either dependency; the normal gate
does not enable coverage.

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

Node and Bun runtime pins remain exact in `.nvmrc` and `packageManager`.
`@types/node` follows the pinned Node major, not the registry's newest major;
an `@types/bun` range starts at the pinned Bun version.

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
licenses and pinned source provenance for copied or adapted code. Update package
docs when exports or compatibility guarantees change.

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

Run a changed package's narrow test first, then `bun run verify`. The root gate
starts with `doctor` and `toolchain:check`, then checks formatting, lint, unused
code and dependencies with Knip, strict types, tests, the documentation build,
library tarball contents and isolated Bun/Node consumers. `build` runs package
`check` first through Turbo.
Set `TOOLKIT_NODE_BINARY` to a Node executable matching `.nvmrc` if Node is not on
PATH; it does not bypass the development pin. Real database tests require an
independent CI job with a temporary PostgreSQL 17 service. Default unit tests,
coverage, tarball checks and local `verify` remain database-free. Drizzle's
explicit `test:integration` command requires CI and `DRIZZLE_TEST_DATABASE_URL`;
missing either must fail rather than skip. Use only test-owned schemas and tables,
clean them up, and close connections. Only a successful Drizzle integration job
provides evidence of real PG17 execution; local `verify` does not provide that
evidence. PostgreSQL 18 is outside the test matrix.

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

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
