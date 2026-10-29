# Raypx Kit Documentation

Raypx Kit contains independently released TypeScript packages. Start with
a package guide to use an API, the architecture guide to understand the repository,
or the development guide to contribute.

## Start here

| Task                                                   | Read                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| Understand package ownership and dependency boundaries | [Architecture](architecture/README.md)                |
| Set up the repository and run checks                   | [Development](development/README.md)                  |
| Upgrade tools, runtimes or package dependencies        | [Dependency maintenance](development/dependencies.md) |
| Prepare independent package versions                   | [Changesets workflow](development/changesets.md)      |
| Publish or preview packages                            | [Publishing runbook](development/publishing.md)       |

## Package guides

These READMEs are the canonical references for current exports, examples,
compatibility and consumer installation. They are also included in npm archives.

| Package       | Guide                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Codemods      | [Migration runner, CLI and adding transformations](../packages/codemods/README.md)                |
| Devkit        | [Workspace, architecture, toolchain and maintenance APIs](../packages/devkit/README.md)           |
| Drizzle       | [PostgreSQL expressions, results and diagnostics](../packages/drizzle/README.md)                  |
| Drizzle Kit   | [Slim upstream CLI and config distribution](../packages/drizzle-kit/README.md)                    |
| Email Preview | [Local template previews, live updates and HTML/text output](../packages/email-preview/README.md) |
| Env           | [Validation, nested presets and client access](../packages/env/README.md)                         |
| Intl          | [Locale negotiation, translation and controlled providers](../packages/intl/README.md)            |
| Analytics     | [Consent-controlled browser analytics and errors](../packages/analytics/README.md)                |
| Logger        | [Structured logging, wide events and request context](../packages/logger/README.md)               |
| Notifications | [Knock workflows, signed user tokens and React feeds](../packages/notifications/README.md)        |
| Security      | [Security headers and optional Arcjet request protection](../packages/security/README.md)         |
| Storage       | [Drivers, policies and signed URLs](../packages/storage/README.md)                                |
| TSConfig      | [Compiler presets and consumer responsibilities](../packages/tsconfig/README.md)                  |
| Themes        | [Shared tokens, initialization and optional React theme state](../packages/themes/README.md)      |
| UI            | [Base UI primitives, shared styles and shadcn configuration](../packages/ui/README.md)            |

Packages remain in Changesets alpha mode until the first approved stable release.
Consumers pin exact prerelease versions; each manifest supplies its own version.

## Designs and migration references

The following documents explain design decisions, upstream research or migration
steps. They supplement the package guides. An inventory row or proposed import
does not make an API available in the current package.

### Drizzle

- [Extension plan](drizzle/merge-plan.md): current foundation, proposed query,
  relation and plugin boundaries, and acceptance criteria.
- [drizzle-plus inventory](drizzle/drizzle-plus-capabilities.md): the complete
  pinned upstream capability review.
- [better-drizzle inventory](drizzle/better-drizzle-capabilities.md): upstream
  APIs, plugins, rules and error codes.
- [Source provenance](../packages/drizzle/NOTICE.md): pinned revisions,
  adaptations and retained licenses.

The implementation scope is PostgreSQL through postgres.js. Inventories also
retain upstream features outside that scope and label them accordingly.

### Intl

- [Controlled provider migration](intl/migration.md): responsibility changes,
  provider and type migration, formatting and request state.

## Editing documentation

Run `bun run docs:dev` from the repository root to browse the site at
`http://localhost:3100/docs`. Fumadocs renders these files and package guides
directly, with navigation, local search and source links. Edit each page's
canonical Markdown rather than making a second copy.

### Languages and translations

The site serves English at `/docs` and Simplified Chinese at `/zh/docs`. The
language picker retains the current page, query and fragment. The URL owns the
server/client locale snapshot, so a browser preference cannot change a shared
link after hydration. Navigation, search, controls and accessibility labels follow
the selected locale through the public `@raypx-kit/intl` provider.

English files remain canonical. The Chinese overview lives in
[content/zh/index.md](content/zh/index.md); other pages currently show their English
body with a localized fallback notice. The source link always identifies the file
actually displayed. To add a translated body, create its Markdown under
`content/zh/`, register its canonical slug in
[the translation map](src/lib/i18n/pages.ts), and keep it covered by the file patterns
in [source.ts](src/lib/source.ts). Page titles and descriptions for Chinese navigation
and search live in that same translation module. Preserve canonical heading anchors
when translating headings, using Fumadocs' `[#heading-id]` suffix where needed.

UI catalogs live under `src/lib/i18n/`. Documentation tests compare catalog keys
and ICU arguments and check translated source links. Fumadocs uses the multilingual
tokenizer and filters search results by locale. Browser checks cover language
switching, Chinese search, mobile navigation, English fallback and SSR without
JavaScript. Run `bun run test:e2e --project docs` for those scenarios.

### Theme integration

The site uses `@raypx-kit/themes` for first paint, React state, system appearance
and localStorage/cookie persistence. The script and provider share the configuration
in [theme.ts](src/lib/theme.ts), including the previous `theme` storage key so saved
choices continue to work. Fumadocs' default theme provider is disabled; its
`themeSwitch` slot hosts the site's light/dark/system control on desktop and mobile.
Labels follow the active language. The D shortcut toggles appearance outside text
inputs and dialogs, and theme choices survive language navigation and reloads.

Page registration and navigation live in [pages.ts](src/lib/pages.ts); the
[architecture guide](architecture/README.md#documentation-flow) explains how
content becomes site pages. Documentation tests run with `bun run test:toolchain`;
`bun run docs:build` checks compilation and prerendering. The complete
`bun run verify` gate includes both. Keep full inventories, proposed API labels
and upstream notices when editing.

Repository design and maintainer guides are excluded from npm archives. See
[site ownership](AGENTS.md) and [site provenance](NOTICE.md) for the internal
application's constraints and licensing.
