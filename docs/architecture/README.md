# Architecture

Raypx Kit publishes seven independently versioned packages. It separates reusable
library behavior from application policy, repository maintenance and the private
documentation application. Published interfaces come from each package's
`package.json` exports and README; research inventories do not expand them.

For working on the repository, see the [development guide](../development/README.md)
and [dependency policy](../development/dependencies.md).

## Repository shape

```text
packages/
  devkit/       Repository maintenance library
  drizzle/      PostgreSQL expressions and result helpers
  drizzle-kit/  Extracted upstream CLI distribution
  env/          Consumer-owned schema validation
  intl/         Locale, translation and controlled React integration
  logger/       evlog facade and asynchronous logger context
  tsconfig/     Published compiler presets
scripts/        Private policy, verification and release orchestration
tests/          Repository maintenance tests and shared test setup
docs/           Canonical Markdown and the private documentation application
```

Public TypeScript entries live directly under each library's `src/`. Supporting
implementation modules may live beneath them. Tests belong to the owning
workspace's `tests/` directory; they are not library build entries.

## Package responsibilities

| Package                                             | Library responsibility                                                                                                                       | Consumer responsibility                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [Devkit](../../packages/devkit/README.md)           | Workspace discovery, metadata and import checks; toolchain declarations; static catalogs; documentation links; process and artifact helpers  | Repository policy, paths, expected runtime pins, cache trust and application health probes            |
| [Drizzle](../../packages/drizzle/README.md)         | Typed projections, explicit UPSERT mappings, JSONB expressions, uniqueness classification, result unwrapping and sanitized EXPLAIN summaries | PostgreSQL schemas, postgres.js clients, transactions, migrations, query execution and business rules |
| [Drizzle Kit](../../packages/drizzle-kit/README.md) | Retain upstream CLI commands and `defineConfig` in a smaller distribution                                                                    | Schema/configuration files, a compatible ORM, database access and migration decisions                 |
| [Env](../../packages/env/README.md)                 | Compose Zod schemas and presets, normalize inputs, validate values and guard client access                                                   | Variable names, secrets, environment loading, application presets and browser-safe value injection    |
| [Intl](../../packages/intl/README.md)               | Immutable locale configuration, negotiation, typed ICU translation, formatting, controlled providers and catalog validation                  | Catalogs, loading, preference state, persistence and consistent SSR/hydration snapshots               |
| [Logger](../../packages/logger/README.md)           | Expose evlog events, errors and drain pipelines; bind an existing logger to asynchronous context                                             | Startup configuration, event fields, redaction policy, emission, drain delivery and shutdown          |
| [TSConfig](../../packages/tsconfig/README.md)       | Shared strict compiler behavior and module-resolution presets                                                                                | Project layout, aliases, references, output directories and runtime-specific ambient types            |

None of the published packages has a runtime dependency on another Raypx Kit
package or on the Raypx product repository. Applications compose the packages;
schemas, authorization, accounting and other domain rules stay in those applications.

## Public entries and dependency boundaries

Subpaths below are relative to their package names. The manifests remain the
authoritative export list.

| Package     | Public entries                                                                                             | Dependency boundary                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Devkit      | `/workspaces`, `/architecture`, `/toolchain`, `/catalogs`, `/docs`, `/process`, `/artifact`; no root entry | Node APIs and external parser/configuration dependencies; its Turbo helper runs under Bun                                                        |
| Drizzle     | Root, `/postgres`, `/errors`, `/results`, `/diagnostics`                                                   | Drizzle ORM is an optional external peer; postgres.js is installed and owned by database consumers                                               |
| Drizzle Kit | Root `defineConfig` for ESM and CommonJS; `drizzle-kit` executable                                         | External upstream CLI dependencies; the CLI resolves an ORM installed in the consumer project                                                    |
| Env         | Root, `/runtime`                                                                                           | Zod is a required external peer, preserving schema runtime identity                                                                              |
| Intl        | Root, `/client`, `/browser`, `/server`, `/types`, `/testing`                                               | React is a required external peer; `use-intl` and the explicitly allowed FormatJS-related dependencies are bundled, including their declarations |
| Logger      | Root, `/context`, `/pipeline`                                                                              | evlog is an external runtime dependency, not a peer or bundled copy; `/context` uses its Node asynchronous storage                               |
| TSConfig    | `/base.json`, `/node.json`, `/browser.json`, `/library.json`, `/react-library.json`; no root entry         | JSON presets extend sibling presets; consumers install the compiler and ambient type packages they need                                          |

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

## From source to installable artifacts

| Packages                           | Build path                                                                 | Published result                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Devkit, Drizzle, Env, Intl, Logger | `src/` entries → `tsdown.config.ts`, using `tsconfig.build.json` → `dist/` | ESM `.mjs`, `.d.mts` declarations and source maps; explicit entry names and dependency bundling rules                                                         |
| Drizzle Kit                        | Installed upstream package → `src/extract.ts` → `dist/`                    | Unchanged upstream CLI/configuration files, declaration chunks and CLI skills; generated `dist/package.json` retains CommonJS semantics for `.js` and `.d.ts` |
| TSConfig                           | Package-root JSON files → archive                                          | The five presets directly; no JavaScript compilation                                                                                                          |

The five tsdown configurations explicitly preserve output extensions and their
consumer runtime targets. Those targets are independent of the repository's
development runtime pins. Drizzle Kit preserves both ESM and CommonJS exports;
its omitted programmatic API and payload bundles are not recreated locally.
Build tasks create the outputs. `pack:check` packs and validates existing outputs;
it does not build them. The root verification pipeline runs builds first.

Package `exports` select the supported interface, while `files` selects the
archive payload. Archives retain package documentation, changelogs, full licenses
and applicable source notices. Research documents, tests and workspace dependencies
are not copied into published libraries. Bundled third-party code retains its
licenses, and extracted upstream code retains its source bytes and license.

## Development dependencies and private orchestration

The private root owns shared development tools and composes repository policy
through `scripts/`. Its toolchain wrapper imports Devkit source directly, so
maintenance checks do not require a prebuilt Devkit archive. This is a development
dependency direction, not a dependency from a published library back to the root.
The TSConfig workspace supplies compiler presets during repository development.

Bun owns installation, native type checks, repository TypeScript scripts and
archive packing. Turbo orders workspace tasks; tsdown builds the five libraries.
Vite+ supplies formatting, linting, tests and the documentation application's
Vite commands. Knip treats the declared library entries as public roots while
checking unused implementation code and dependencies. Independent Changesets
versions keep these shared development tools from linking package release cycles.

## Verification boundaries

| Layer                            | Contract checked                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source checks and package tests  | Strict source/test types, implementation behavior and deliberate error cases; library builds include production sources only                                                          |
| Knip                             | Source reachability, declared dependencies and internal exports, with public entries preserved even without workspace callers                                                         |
| Archive checks                   | Expected files, exported targets, binaries, complete retained notices and dependency protocols suitable for publication                                                               |
| Isolated consumers               | Install the actual archive outside the workspace; load public exports with Bun and Node, check supported CommonJS conditions and binary links, and resolve declarations with NodeNext |
| Package consumer fixtures        | Additional public runtime and type contracts against the installed archive, with their own dependency and compiler environments                                                       |
| Consumers without optional peers | Independently verify Drizzle's driver-free entries and strict declarations, and confirm ORM-dependent entries still require the missing ORM                                           |

Tests use Bun workers with Vitest's `node` or `jsdom` environment. Intl's client
tests use a Bun-specific jsdom preload. These test-runtime choices do not make
the published libraries depend on the repository's test setup.

Ordinary archive declaration checks skip third-party declaration bodies where
optional upstream adapters are absent. Focused consumer fixtures can require
stricter checks; the consumer without optional peers uses `skipLibCheck: false`
without ambient Node or DOM types. Source aliases cannot substitute for these
installed-package contracts. Drizzle's current checks cover SQL construction,
result mapping and types; they do not run a live PostgreSQL integration suite.

## Documentation flow

The private `docs` workspace compiles canonical root Markdown, package READMEs
and notices through Fumadocs. `docs/src/lib/pages.ts` registers source paths,
page metadata and navigation. `docs/src/lib/source.ts` supplies that registered
content to the site; there is no synchronized Markdown copy.

The build rewrites registered documentation links to site routes and keeps other
repository files as GitHub source links. TanStack Start prerenders the registered
pages and search endpoint; Fumadocs builds search from the same content source.
The application uses the Nitro Bun preset and remains outside npm publication
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
