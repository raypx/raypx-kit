# @raypx-kit/drizzle

## 0.0.0-alpha.0

Initial Raypx Kit prerelease.

- Include typed column projections, explicit UPSERT mappings, parameterized JSONB expressions,
  postgres.js uniqueness classification, result helpers and sanitized EXPLAIN diagnostics.
- Keep Drizzle external as an optional peer: error and result helpers work without it;
  ORM-backed entries require an explicit installation. Consumers install postgres.js and own connections.
- Retain upstream inventories and plans as documentation, with complete licenses and provenance.
- Normalize Drizzle query builders through their public SQL before EXPLAIN, preserving
  bound parameters and valid syntax for write statements.
- Use dependency ranges, restrict Drizzle to the tested RC5 family, and align
  the resolved coverage provider with Vite+'s bundled Vitest.
