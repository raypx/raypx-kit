# Raypx Kit

Reusable TypeScript libraries maintained by [Raypx](https://github.com/raypx).
Each public package has its own version, changelog and npm artifact. Applications
own their schemas, secrets, business rules and runtime configuration.

## Packages

| Package                                                      | Purpose                                                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [@raypx-kit/codemods](packages/codemods/README.md)           | Explicit-file migration runner and CLI; built-in migrations are added as needed                 |
| [@raypx-kit/devkit](packages/devkit/README.md)               | Workspace boundaries, toolchain checks, catalogs, artifact probes and task helpers              |
| [@raypx-kit/drizzle](packages/drizzle/README.md)             | PostgreSQL projections, UPSERT and JSONB expressions, result helpers and diagnostics            |
| [@raypx-kit/drizzle-kit](packages/drizzle-kit/README.md)     | Slim upstream drizzle-kit CLI and defineConfig distribution                                     |
| [@raypx-kit/email-preview](packages/email-preview/README.md) | React Email previews as a Vite plugin, with live updates and HTML/text inspection               |
| [@raypx-kit/env](packages/env/README.md)                     | Zod environment validation, nested presets, defaults and guarded client access                  |
| [@raypx-kit/intl](packages/intl/README.md)                   | Locale negotiation, ICU translation, formatting and controlled React providers                  |
| [@raypx-kit/analytics](packages/analytics/README.md)         | Consent-controlled PostHog product events and sanitized browser errors                          |
| [@raypx-kit/logger](packages/logger/README.md)               | evlog structured logging, wide events and Node request context                                  |
| [@raypx-kit/notifications](packages/notifications/README.md) | Knock workflow client, signed user tokens and optional React notification feeds                 |
| [@raypx-kit/security](packages/security/README.md)           | Nosecone security headers and optional Arcjet protection with application-owned keys and rules  |
| [@raypx-kit/storage](packages/storage/README.md)             | Object storage for S3-compatible services, the filesystem and memory with signed URLs           |
| [@raypx-kit/tsconfig](packages/tsconfig/README.md)           | Strict TypeScript presets for libraries, browsers and Node                                      |
| [@raypx-kit/themes](packages/themes/README.md)               | Shared theme tokens, initialization script and optional React theme state                       |
| [@raypx-kit/ui](packages/ui/README.md)                       | shadcn-style React primitives on Base UI, shared styles and class utilities (not yet published) |

Package READMEs describe shipped APIs and installation requirements. All packages
start at `0.0.0-alpha.0` and are independently versioned in Changesets alpha mode;
consumers pin exact prerelease versions. Drizzle query clients, relations and
plugins in the design documents remain planned work.
Public packages require Node `22.21+`. Security follows Arcjet's supported range,
`>=22.21.0 <23 || >=24.5.0`, excluding Node 23 and earlier Node 24 releases.
Repository development uses the pin below.

## Quick start

Use Bun **1.4.4**, pinned in root `packageManager`. With mise installed:

```sh
mise trust && mise install
mise exec -- bun install --frozen-lockfile
mise exec -- bun run verify --full
```

For development, activate mise in your shell or prefix repository commands with
`mise exec --`. Other version managers work when they select the same pins.
See the [development guide](docs/development/README.md) for setup, focused checks
and common commands.

```sh
bun run docs:dev  # http://localhost:3100/docs
```

The internal Fumadocs workspace renders the canonical repository Markdown directly;
edit the source linked from each page.

## Documentation

- [Documentation index](docs/README.md): package guides, designs and maintainer references.
- [Architecture](docs/architecture/README.md): package ownership, dependency boundaries,
  build outputs, verification and documentation flow.
- [Development](docs/development/README.md): setup, commands, tests and adding a package.
- [Dependency maintenance](docs/development/dependencies.md): version ranges,
  compatibility checks and upgrade procedure.
- [Changesets workflow](docs/development/changesets.md): independent versions,
  alpha releases and version preparation.
- [Publishing runbook](docs/development/publishing.md): authorized publication,
  consumer previews, CI setup and recovery.

The development branch is `canary`. Automatic version PRs and npm publication are
separately disabled until maintainers enable their repository settings. Normal
installation, builds and verification do not publish packages.

## License

Raypx Kit is Apache-2.0 unless a package declares otherwise. Adapted and bundled
upstream code retains its original terms; see each package's `LICENSE` and
applicable `NOTICE.md`.
