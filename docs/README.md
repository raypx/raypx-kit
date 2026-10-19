# Raypx Kit Documentation

Raypx Kit contains seven independently released TypeScript libraries. Start with
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

| Package     | Guide                                                                                   |
| ----------- | --------------------------------------------------------------------------------------- |
| Devkit      | [Workspace, architecture, toolchain and maintenance APIs](../packages/devkit/README.md) |
| Drizzle     | [PostgreSQL expressions, results and diagnostics](../packages/drizzle/README.md)        |
| Drizzle Kit | [Slim upstream CLI and config distribution](../packages/drizzle-kit/README.md)          |
| Env         | [Validation, nested presets and client access](../packages/env/README.md)               |
| Intl        | [Locale negotiation, translation and controlled providers](../packages/intl/README.md)  |
| Logger      | [Structured logging, wide events and request context](../packages/logger/README.md)     |
| TSConfig    | [Compiler presets and consumer responsibilities](../packages/tsconfig/README.md)        |

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

Page registration and navigation live in [pages.ts](src/lib/pages.ts); the
[architecture guide](architecture/README.md#documentation-flow) explains how
content becomes site pages. Documentation tests run with `bun run test:toolchain`;
`bun run docs:build` checks compilation and prerendering. The complete
`bun run verify` gate includes both. Keep full inventories, proposed API labels
and upstream notices when editing.

Repository design and maintainer guides are excluded from npm archives. See
[site ownership](AGENTS.md) and [site provenance](NOTICE.md) for the private
application's constraints and licensing.
