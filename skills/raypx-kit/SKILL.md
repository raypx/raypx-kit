---
name: raypx-kit
description: Usage guide for the @raypx-kit/* npm libraries — env (typed environment), intl (ICU translations and React language preferences), logger (evlog wide events and safe drains), analytics (consent-controlled PostHog), storage (S3/R2/fs object storage with signed URLs), drizzle and drizzle-kit (PostgreSQL extensions and slim CLI), devkit (monorepo checks), tsconfig (strict presets) and codemods. Use when installing, configuring, upgrading or debugging any @raypx-kit package.
---

# Raypx Kit

Raypx Kit is a set of small, independently versioned ESM libraries published as
`@raypx-kit/*`. Each one does a single job and leaves application policy to you:
no package reads `.env` files, initializes itself on import or ships product rules.

## Install

Every package is still a prerelease (`0.0.0-alpha.N`). **Pin exact versions**:
prereleases can change public APIs between alphas.

```sh
bun add @raypx-kit/env@0.0.0-alpha.0 zod@^4.6.7
```

All packages are ESM-only and support Node 22.14+ and Bun. Check `npm view
@raypx-kit/<name> dist-tags` for the current version before pinning.

## Packages

| Package                  | Use it for                                                         | Peers                    | Reference                                                  |
| ------------------------ | ------------------------------------------------------------------ | ------------------------ | ---------------------------------------------------------- |
| `@raypx-kit/env`         | Zod-validated env with presets and browser access guards           | `zod`                    | [environment](references/environment.md)                   |
| `@raypx-kit/intl`        | Typed ICU catalogs, controlled React providers, locale preferences | `react`                  | [internationalization](references/internationalization.md) |
| `@raypx-kit/logger`      | evlog wide events, request context, field policy, drains           | —                        | [observability](references/observability.md)               |
| `@raypx-kit/analytics`   | Opt-in PostHog events and sanitized browser errors                 | `react` (optional)       | [analytics](references/analytics.md)                       |
| `@raypx-kit/storage`     | One object storage API for S3/R2/MinIO, filesystem, memory         | —                        | [storage](references/storage.md)                           |
| `@raypx-kit/drizzle`     | PostgreSQL helpers for Drizzle RC5 + postgres.js                   | `drizzle-orm` (optional) | [database](references/database.md)                         |
| `@raypx-kit/drizzle-kit` | drizzle-kit CLI without the 100 MB programmatic bundles            | —                        | [database](references/database.md)                         |
| `@raypx-kit/devkit`      | Workspace boundary, toolchain, catalog, link and artifact checks   | —                        | [devkit](references/devkit.md)                             |
| `@raypx-kit/tsconfig`    | Strict TypeScript presets                                          | `typescript`             | [typescript-config](references/typescript-config.md)       |
| `@raypx-kit/codemods`    | Explicit-file source migration runner and CLI                      | —                        | [codemods](references/codemods.md)                         |

## Principles shared by every package

- **Explicit configuration.** Pass every option in code; the library never reads
  `process.env`, config files or globals on your behalf.
- **Nothing at import time.** Importing never initializes SDKs, loggers or clients,
  so every entry is safe in SSR and tests.
- **Subpath entries.** Import the narrowest entry (`@raypx-kit/logger/safe`,
  `@raypx-kit/storage/s3`…). Platform-specific code stays behind its own entry
  (for example `/context` needs `node:async_hooks`, `storage/fs` needs Node).
- **Privacy by default.** Logger policies, analytics policies and storage errors
  never forward credentials, messages, stacks or paths; keep secrets out of any
  custom fields you add.
- **One React instance.** React packages take React as a peer. When previewing a
  linked checkout, dedupe `react`/`react-dom` in your bundler. Never install
  `use-intl`/`next-intl` beside `@raypx-kit/intl`: it bundles its own copy.

## Common tasks

- **Typed environment:** `createEnv({ extends: [runtimeEnv], server, client })`;
  public keys use the `VITE_` prefix. → [environment](references/environment.md)
- **Translations:** build a runtime with `createLocaleRuntime`, bind hooks with
  `createIntlClient<typeof en>()(runtime)`, check catalogs in tests with
  `assertMessageCatalogParity`. → [internationalization](references/internationalization.md)
- **One log event per request/job:** `initLogger` once, `createRequestLogger`,
  `set` fields, `emit` once; wrap the drain with `withEventPolicy`. → [observability](references/observability.md)
- **Uploads without proxying bytes:** `createStorage(createS3Driver(...))`, then
  `signUpload`/`signDownload`. → [storage](references/storage.md)
- **Product analytics with consent:** `createBrowserAnalytics({ policy })`, call
  `setConsent` only after a user choice. → [analytics](references/analytics.md)

Full package documentation: [README files on GitHub](https://github.com/raypx/raypx-kit/blob/canary/packages).
