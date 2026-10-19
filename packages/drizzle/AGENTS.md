# @raypx-kit/drizzle

## Purpose

A standalone Drizzle extension library for PostgreSQL through postgres.js.
Raypx DB is an intended consumer; product integration is separate. The library
owns no Raypx domain behavior and can ship independently.

## Interface

| Path            | Purpose                                                               |
| --------------- | --------------------------------------------------------------------- |
| `.`             | Typed column projections                                              |
| `./postgres`    | Explicit UPSERT mappings, JSONB paths and nullable scalar expressions |
| `./errors`      | postgres.js uniqueness classification                                 |
| `./results`     | Nullable and required result unwrapping                               |
| `./diagnostics` | EXPLAIN SQL construction and sanitized plan summaries                 |

The complete upstream inventory and merge roadmap are in
[extension design](../../docs/drizzle/merge-plan.md).
Public TypeScript entry files live directly under `src/`. Public imports resolve
to flat ESM entry files and declarations under `dist/`.
Tests live under `tests/`, retaining supporting `diagnostics/` and `postgres/`
subdirectories; library builds include only `src/`. Consumer declaration fixtures
are excluded from source checks and checked against installed tarballs instead.
Preserve the additional consumer without optional peers: it checks `/errors` and
`/results` through Bun, Node and strict TypeScript without installing the ORM.

## Ownership

- Own reusable expressions, result decoding, safe SQL construction and generic
  query diagnostics. Drizzle is an optional peer dependency, never bundled.
  `/errors` and `/results` must work without it at runtime and in declarations;
  root, `/postgres` and `/diagnostics` require an explicitly installed ORM.
- Keep adapted source commits, notices and complete MIT terms in `NOTICE.md`.
  Complete Apache-2.0 terms and the upstream copyright remain in `LICENSE`.
- Preserve the native database and transaction handles supplied by consumers.
- Keep complete upstream capability inventories even when Raypx does not use a
  capability. A planned API is not an implemented export.

## Constraints

- Runtime code must not import any other Raypx Kit package, Raypx product workspace or Bun-specific APIs.
- Use public Drizzle APIs. No global prototype patching or private query fields.
- PostgreSQL is the only supported dialect, and postgres.js through
  `drizzle-orm/postgres-js` is the only supported driver. Do not add npm `pg`,
  node-postgres, SQLite, MySQL or alternate PostgreSQL driver adapters.
- Drizzle's `pg-core`, `PgTable`, `pgTable` and `PgDialect` name the PostgreSQL
  dialect and remain valid; they do not refer to the unsupported npm `pg` driver.
- Paths and values are bound parameters; identifier names are quoted. Update
  helpers require explicit conflict targets and update-key allowlists.
- SQL scalar conversion uses CASE guards and explicit decoders. Consumers own
  strict business validation, including whether missing values are acceptable.
- Diagnostics return only the documented metric allowlist, never SQL parameters,
  predicates, raw plans or original driver exceptions.
- Actor-bound cursor encoding, permission rules, account usage policy, Run leases,
  connection management and migration/schema ownership remain in `@raypx/db`.
- Drizzle peer and development declarations use
  `>=1.0.0-rc.5-5935859 <1.0.0-rc.5-z`. This range admits RC5 hash builds;
  validate the lockfile's selected build with the type and postgres.js PostgreSQL
  test matrix before accepting updates. Widen the RC family only after that matrix
  passes. `postgres` remains a development dependency; database consumers install
  their own driver.
- Use caret ranges for stable dependencies, including `postgres` and coverage
  providers. Keep the Drizzle ORM/CLI declarations and consumer fixtures on the
  same RC5 range. Installed coverage providers must match Vite+'s bundled Vitest.

## Verification

```bash
bun run build --filter=@raypx-kit/drizzle
bun run --cwd packages/drizzle check
bun run --cwd packages/drizzle test
bun run --cwd packages/drizzle pack:check
```
