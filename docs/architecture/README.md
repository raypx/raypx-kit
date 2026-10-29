# Architecture

Raypx Kit publishes independently versioned packages. It separates reusable
library behavior from application policy, repository maintenance and the internal
documentation application. Published interfaces come from each package's
`package.json` exports and README; research inventories do not expand them.

For working on the repository, see the [development guide](../development/README.md)
and [dependency policy](../development/dependencies.md).

## Repository shape

```text
packages/
  codemods/     Explicit-file migration runner and CLI scaffold
  devkit/       Repository maintenance library
  drizzle/      PostgreSQL expressions and result helpers
  drizzle-kit/  Extracted upstream CLI distribution
  email-preview/ React Email preview Vite plugin and prebuilt client interface
  env/          Consumer-owned schema validation
  intl/         Locale, translation and controlled React integration
  analytics/    consent-controlled PostHog browser events and sanitized errors
  logger/       evlog facade and asynchronous logger context
  notifications/ Knock workflow client, user tokens and optional React feeds
  security/     Security headers and optional Arcjet request protection
  storage/      Object storage drivers and signed URLs
  themes/       Shared tokens, CSS and optional React theme state
  tsconfig/     Published compiler presets
  ui/           shadcn-style Base UI primitives and class utilities
scripts/
  cli.ts        Internal maintenance command entry
  checks/       Source architecture, dependencies and toolchain policy
  packages/     Archives, isolated consumers and compatibility matrix
  release/      Release commands, scope checks and validation
  ci/           CI diagnostics and consumer runtime setup
  shared/       Internal helpers for temporary directories and atomic file writes
tests/
  scripts/      Maintenance tests grouped by the same responsibilities
  setup/        Shared test preloads
e2e/            Shared browser project inventory, runner and fixture server
docs/           Canonical Markdown and the internal documentation application
```

Public TypeScript entries live directly under each library's `src/`. Supporting
implementation modules may live beneath them. Unit and integration tests belong to
the owning workspace's `tests/` directory, with browser scenarios in sibling
`e2e/`; neither directory is a library build entry.
Internal maintenance filenames use their containing directory for context; public
package entries and framework-recognized configuration filenames remain stable.

Shared filesystem helpers live in `scripts/shared/fs.ts`, with tests in
`tests/scripts/shared/`. They support the internal release and compatibility
scripts and are not published as library APIs.

## Package responsibilities

| Package                                                 | Library responsibility                                                                                                                       | Consumer responsibility                                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [Codemods](../../packages/codemods/README.md)           | Run transformations over explicit files, preview changes and write only when requested                                                       | Migration semantics, file selection, review and rollback                                              |
| [Devkit](../../packages/devkit/README.md)               | Workspace discovery, metadata and import checks; toolchain declarations; static catalogs; documentation links; process and artifact helpers  | Repository policy, paths, expected runtime pins, cache trust and application health probes            |
| [Drizzle](../../packages/drizzle/README.md)             | Typed projections, explicit UPSERT mappings, JSONB expressions, uniqueness classification, result unwrapping and sanitized EXPLAIN summaries | PostgreSQL schemas, postgres.js clients, transactions, migrations, query execution and business rules |
| [Drizzle Kit](../../packages/drizzle-kit/README.md)     | Retain upstream CLI commands and `defineConfig` in a smaller distribution                                                                    | Schema/configuration files, a compatible ORM, database access and migration decisions                 |
| [Email Preview](../../packages/email-preview/README.md) | Discover templates, render HTML/text in a Vite environment and serve a prebuilt preview UI                                                   | Trusted React Email templates, preview props, dependencies and local assets                           |
| [Env](../../packages/env/README.md)                     | Compose Zod schemas and presets, normalize inputs, validate values and guard client access                                                   | Variable names, secrets, environment loading, application presets and browser-safe value injection    |
| [Intl](../../packages/intl/README.md)                   | Immutable locale configuration, negotiation, typed ICU translation, formatting, controlled providers and catalog validation                  | Catalogs, loading, preference state, persistence and consistent SSR/hydration snapshots               |
| [Analytics](../../packages/analytics/README.md)         | Consent-gated browser events, sanitized errors and optional React bindings                                                                   | Product schemas, identity, preferences, configuration and release uploads                             |
| [Logger](../../packages/logger/README.md)               | Expose evlog events, errors and drain pipelines; bind an existing logger to asynchronous context                                             | Startup configuration, event fields, redaction policy, emission, drain delivery and shutdown          |
| [Notifications](../../packages/notifications/README.md) | Explicit Knock client construction, user-token signing and React notification feed composition                                               | Knock accounts and keys, authenticated identity, workflows, channel configuration and delivery policy |
| [Security](../../packages/security/README.md)           | Compose Nosecone headers and adapt Fetch requests to optional Arcjet protection                                                              | Header policy, Arcjet keys and rules, request identity and enforcement decisions                      |
| [TSConfig](../../packages/tsconfig/README.md)           | Shared strict compiler behavior and module-resolution presets                                                                                | Project layout, aliases, references, output directories and runtime-specific ambient types            |
| [Themes](../../packages/themes/README.md)               | Theme tokens, generated CSS, initialization script and optional React state                                                                  | Initial theme, persistence key, document integration and product preferences                          |
| [UI](../../packages/ui/README.md)                       | Base UI primitives, shadcn conventions and shared component styles                                                                           | Tailwind compilation, application layout, copy and component composition                              |

Published packages never depend on the Raypx product repository. UI depends on
Themes for its shared CSS tokens; Email Preview bundles both packages into its
prebuilt interface. Applications retain schemas, authorization, accounting and
other domain rules.

## Public entries and dependency boundaries

Subpaths below are relative to their package names. The manifests remain the
authoritative export list.
Public packages declare Node `>=22.21`; Security follows Arcjet's narrower
`>=22.21.0 <23 || >=24.5.0` range. The tsdown builds target Node 22.21.0.
The development runtime pin remains separate.

| Package       | Public entries                                                                                                                  | Dependency boundary                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Codemods      | Root runner API; `raypx-kit-codemod` executable                                                                                 | Node filesystem APIs, no runtime dependencies; the built-in migration registry starts empty                                                      |
| Devkit        | `/workspaces`, `/architecture`, `/toolchain`, `/catalogs`, `/docs`, `/process`, `/artifact`, `/lint`, `/testing`; no root entry | Node APIs and external parser/configuration dependencies; lint/test presets contain plain data and its Turbo helper runs under Bun               |
| Drizzle       | Root, `/postgres`, `/errors`, `/results`, `/diagnostics`                                                                        | Drizzle ORM is an optional external peer; postgres.js is installed and owned by database consumers                                               |
| Drizzle Kit   | Root `defineConfig` for ESM and CommonJS; `drizzle-kit` executable                                                              | External upstream CLI dependencies; the CLI resolves an ORM installed in the consumer project                                                    |
| Env           | Root, `/runtime`                                                                                                                | Zod is a required external peer, preserving schema runtime identity                                                                              |
| Intl          | Root, `/client`, `/browser`, `/server`, `/types`, `/testing`                                                                    | React is a required external peer; `use-intl` and the explicitly allowed FormatJS-related dependencies are bundled, including their declarations |
| Logger        | Root, `/context`, `/pipeline`                                                                                                   | evlog is an external runtime dependency, not a peer or bundled copy; `/context` uses its Node asynchronous storage                               |
| Notifications | Root, `/react`, `/styles.css`                                                                                                   | Server root uses external Knock Node SDK; React and the Knock React SDK are optional external peers isolated under `/react`                      |
| Security      | Root, `/arcjet`                                                                                                                 | Universal headers use external Nosecone; the Node-only Arcjet entry uses an optional external SDK peer                                           |
| TSConfig      | `/base.json`, `/node.json`, `/browser.json`, `/library.json`, `/react-library.json`; no root entry                              | JSON presets extend sibling presets; consumers install the compiler and ambient type packages they need                                          |
| Email Preview | Root (`emailPreview()` Vite plugin), `/package.json`                                                                            | Vite is a peer; the prebuilt interface bundles UI/Themes; template dependencies and React resolve from the consumer project                      |
| Themes        | Root, `/config`, `/script`, `/styles.css`, `/tailwind.css`                                                                      | Root React APIs use an optional peer; config, script and CSS work independently                                                                  |
| UI            | Root, `/components/ui/*` (explicit exports), `/lib/utils`, `/styles.css`                                                        | Base UI primitives, Themes CSS and external React/React DOM/Tailwind peers                                                                       |

Codemods provides a runner, not a set of automatic project upgrades. Callers pass
a transformation and explicit file paths to `runCodemod`; previews are the default
and writes require `write: true`. The CLI exposes the built-in registry, which
contains no migrations initially. Add an AST parser only when a concrete migration
needs one, and cover that migration with fixtures before registering it.

Drizzle's optional peer is an installation choice for independent helpers.
`/errors` and `/results` work without the ORM or a database driver. Root,
`/postgres` and the entire `/diagnostics` entry require the ORM, including when
only the plan summarizer or its types are imported. SQL construction does not
create a database connection. Database compatibility is PostgreSQL through
postgres.js; it does not extend to other drivers or dialects.

Intl keeps compilation, caches and the `IntlProvider` context in its bundled
upstream runtime. Kit's controlled `LanguageProvider` uses a separate preference
context; applications still supply its values and updates. React remains required
for the package, including root/server consumers. Factories bind catalog types
and defaults rather than creating independent translation contexts or owning
mutable locale state. `/testing` is a public consumer utility, not a repository
test fixture.

Logger initialization configures evlog globally; creating an event is not creating
an independent logging configuration. Context helpers bind the caller's logger,
preserve synchronous or asynchronous return values and restore nested scopes.
They neither emit events nor merge parent fields. The root and pipeline entries
do not import the Node context entry.

Notifications keeps the Knock Node client and token signer in its server-only
root. The optional React entry composes the official Knock provider and feed
components without importing the server SDK. Applications supply credentials,
authenticated users, signing keys and feed channels, and retain ownership of
workflows and authorization. Production delivery runs through the configured
Knock service; browser tests use a local test-owned API.

Security keeps header construction independent of Arcjet and frameworks. Only
the optional `/arcjet` entry uses the Node SDK; applications provide the key and
rules and decide how to enforce each result. Its SDK runtime range excludes
Node 23 and Node 24 releases before 24.5.0; the package does not promise support
for those runtimes.

## From source to installable artifacts

| Packages                                                                                      | Build path                                                                 | Published result                                                                                                                                              |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codemods, Devkit, Drizzle, Env, Intl, Analytics, Logger, Notifications, Security, Storage, UI | `src/` entries → `tsdown.config.ts`, using `tsconfig.build.json` → `dist/` | ESM `.mjs`, `.d.mts` declarations and source maps; explicit entry names and dependency bundling rules                                                         |
| Drizzle Kit                                                                                   | Installed upstream package → `src/extract.ts` → `dist/`                    | Unchanged upstream CLI/configuration files, declaration chunks and CLI skills; generated `dist/package.json` retains CommonJS semantics for `.js` and `.d.ts` |
| Email Preview                                                                                 | Plugin → tsdown; interface → Vite+ static build                            | `dist/index.mjs` and `dist/ui/`; consumers never build the preview UI                                                                                         |
| TSConfig                                                                                      | Package-root JSON files → archive                                          | The five presets directly; no JavaScript compilation                                                                                                          |
| Themes                                                                                        | Token source → CSS generator; TypeScript entries → tsdown                  | ESM and declarations, package-root `styles.css` and Tailwind mappings                                                                                         |

The tsdown configurations explicitly preserve output extensions and their
consumer runtime targets. Those targets are independent of the repository's
development runtime pins. Drizzle Kit preserves both ESM and CommonJS exports;
its omitted programmatic API and payload bundles are not recreated locally.
Email Preview is public tooling with a prebuilt interface. Its root export is the
`emailPreview()` Vite plugin, which projects run with `vite dev`. Templates run in a dedicated Vite environment of the consumer's dev
server, while the installed UI assets remain read-only. The browser receives rendered output and file-change notifications.
Its build derives complete third-party license notices from the actual bundled
module graphs and writes `dist/THIRD_PARTY_LICENSES.txt`. The root Turbo `dist/`
output rule caches these notices with the application. They remain outside Git
and ship in the archive; package `LICENSE` files are not build outputs.
UI retains explicit `components/ui/*` exports, a utility entry and package-root
styles. Consumers compile these styles with Tailwind 4; `@source` includes classes
from the installed UI distribution. Themes exposes framework-independent config
and initialization entries alongside its optional React provider.
Build tasks create the outputs. `pack:check` packs and validates existing outputs;
it does not build them. The root verification pipeline runs builds first.

Package `exports` select the supported interface, while `files` selects the
archive payload. Archives retain package documentation, changelogs, package licenses
and applicable source notices. UI, Themes, Email Preview, Notifications and Security keep their own Apache
license in `LICENSE` and a generated direct runtime and peer dependency index in
their READMEs. Ordinary external dependencies carry their own license texts.
Research documents, tests and workspace dependencies are not copied into published
libraries. Bundled third-party code retains complete licenses and notices;
copied or extracted upstream code retains its license and source provenance,
including UI's shadcn MIT license and notice and Themes' original source notice.

## Development dependencies and internal orchestration

The internal root owns shared development tools and composes repository policy
through `scripts/` and [devkit.config.ts](../../devkit.config.ts). That typed
configuration contains all workspaces' architecture rules and the toolchain
document and Turbo dependency check lists. The scripts explicitly import it and
pass plain data to Devkit; scanning another repository never executes its
configuration. Workspace metadata maps must cover the discovered workspace paths
exactly. Manifests retain exports, dependencies and supported runtime ranges;
`.nvmrc` and root `packageManager` retain the development pins.

The wrappers import Devkit source directly, so
maintenance checks do not require a prebuilt Devkit archive. This is a development
dependency direction, not a dependency from a published library back to the root.
Root type checking includes the configuration, and Turbo global dependencies
include it so policy changes invalidate cached workspace tasks. The TSConfig
workspace supplies compiler presets during repository development.

Bun owns installation, native type checks, repository TypeScript scripts and
archive packing. Turbo orders workspace tasks; tsdown builds the ESM libraries.
Vite+ supplies formatting, linting, tests and the documentation application's
Vite commands. Knip treats the declared library entries as public roots while
checking unused implementation code and dependencies. Independent Changesets
versions keep these shared development tools from linking package release cycles.

## Verification boundaries

| Layer                            | Contract checked                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source checks and package tests  | Strict source/test types, implementation behavior and deliberate error cases; library builds include production sources only                                                          |
| Workspace architecture           | Explicit source entries, dependency cycles, declared runtime imports, public cross-workspace imports and platform boundaries before building                                          |
| Knip                             | Source reachability, declared dependencies and internal exports, with public entries preserved even without workspace callers                                                         |
| Browser E2E                      | Package-owned Playwright scenarios exercise built React exports and real applications in Chromium, with isolated contexts and local test data                                         |
| Archive checks                   | Expected files, exported targets, binaries, complete retained notices and dependency protocols suitable for publication                                                               |
| Isolated consumers               | Install the actual archive outside the workspace; load public exports with Bun and Node, check supported CommonJS conditions and binary links, and resolve declarations with NodeNext |
| Package consumer fixtures        | Additional public runtime and type contracts against the installed archive, with their own dependency and compiler environments                                                       |
| Consumers without optional peers | Independently verify Drizzle's driver-free entries and strict declarations, and confirm ORM-dependent entries still require the missing ORM                                           |
| CI compatibility matrix          | Reuse the same archives at each package's minimum supported Node and the development pin, with minimum and locked peer versions                                                       |
| CI database integration          | A separate job configures temporary PostgreSQL 17 and the explicit Drizzle suite for real JSONB, UPSERT, SQLSTATE and EXPLAIN behavior                                                |

Unit tests use Bun workers with Vitest's `node` or `jsdom` environment. Intl's client
tests use a Bun-specific jsdom preload. These test-runtime choices do not make
the published libraries depend on the repository's test setup.

Ordinary archive declaration checks skip third-party declaration bodies where
optional upstream adapters are absent. Focused consumer fixtures can require
stricter checks; the consumer without optional peers uses `skipLibCheck: false`
without ambient Node or DOM types. Source aliases cannot substitute for these
installed-package contracts. Default unit tests, coverage, tarball checks and
local `verify` remain database-free, including Drizzle's SQL construction, mocked
result mapping and type checks.

The architecture gate receives workspace metadata and explicit source-entry
mappings from root `devkit.config.ts`, so it checks production source without
requiring `dist/`. Missing or unknown workspace paths are errors, and inline
manifest policy cannot fill gaps in the supplied map. Platform
overrides describe browser, Node and Bun entries independently. Explicit bundled
dependency declarations cover source dependencies intentionally included in an
archive. Apps and tooling may bundle declared internal development dependencies
through public exports; this preserves platform, application and cycle constraints. Drizzle Kit's local
extractor is checked as tooling, while its copied upstream payload is verified
by the archive contracts.

Compatibility jobs consume archives produced with the pinned development
toolchain. They select packages by their declared Node support and run public
export, CLI and fixture contracts with a separate consumer Node executable.
Internal runtime dependencies install from the same batch of verified archives,
and exported CSS assets are resolved and read without importing them as JavaScript.
Minimum peer versions and the lockfile's tested peer versions use independent
installations. These jobs supplement the ordinary Bun/Node archive checks and
do not require a local database.

Drizzle's separate CI job runs `test:integration` against a temporary PostgreSQL 17
service through `DRIZZLE_TEST_DATABASE_URL`. The command fails without CI or the
test URL. Its schema and table fixtures belong only to the test run and are
cleaned up with their connections. Only a successful Drizzle integration job
provides evidence of real PG17 execution; local `verify` does not. PostgreSQL 18
is outside the test matrix. See the [CI integration policy](../development/README.md#ci-database-integration).

## Documentation flow

The internal `docs` workspace compiles canonical root Markdown, package READMEs
and notices through Fumadocs. `docs/src/lib/pages.ts` registers source paths,
page metadata and navigation. `docs/src/lib/source.ts` supplies that registered
content to the site; there is no synchronized Markdown copy.

The documentation UI consumes `@raypx-kit/intl` through public exports. A controlled
provider renders the URL-selected English or Chinese catalog consistently on the
server and client. English routes stay at `/docs`; Chinese routes use `/zh/docs`.
Fumadocs receives localized page metadata and navigation, and its multilingual
search filters results by the requested locale. Optional translations live under
`docs/content/zh/` and are registered by canonical slug. Untranslated bodies retain
their English source, an explicit fallback notice and the correct body language.
Markdown links preserve the active locale even when displaying an English fallback.

`@raypx-kit/themes` owns the documentation theme provider and the first-paint script.
Fumadocs supplies the layout slot for the light/dark/system controls; its default
theme provider is disabled. Script and provider share the legacy `theme` storage
key, and the app keeps a single D-key shortcut outside text inputs and dialogs.

The build rewrites registered documentation links to site routes and keeps other
repository files as GitHub source links. TanStack Start prerenders the registered
pages; Fumadocs serves search results from the same content source through the
TanStack Start file route at `/api/search`. Nitro builds a Cloudflare Worker for
the API alongside static page assets, using its Bun preset during development.
The application remains outside npm publication
and library release versions. UI routing and site dependencies do not become
library runtime dependencies.

## Current implementation and future extensions

The [Drizzle merge plan](../drizzle/merge-plan.md) and upstream inventories retain
research, proposed interfaces and unsupported capabilities. The shipped package
contains the foundation listed in its README. Query clients, relation compilers,
query plugins and compatibility facades in that plan are not current exports.
Product integration is separate work.

An extension belongs here when it has a reusable interface, explicit consumer
ownership and a verifiable package contract. Before adding one:

- Define its entry, runtime support and external or bundled dependencies.
- Keep application schemas, secrets, framework lifecycle and domain policy with
  consumers; accept those inputs explicitly where required.
- Add source tests and public archive contracts for behavior and type boundaries.
- Retain third-party licenses and provenance, and update the package guide when
  the interface changes.
- Add a separate package only for a distinct consumer need, dependency boundary
  or maintenance lifecycle; keep versions independent.

Operational details and compatibility ranges belong in the
[development guide](../development/README.md), [dependency policy](../development/dependencies.md)
and individual package guides rather than this architectural overview.
