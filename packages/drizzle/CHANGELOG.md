# @raypx-kit/drizzle

## 0.0.0-alpha.2

### Patch Changes

- 0b904b6: Republish through the CI release pipeline with npm provenance. No functional changes.

## 0.0.0-alpha.1

### Major Changes

- a6af9fe: Raise the minimum supported Node.js version from 22.14.0 to 22.21.0. Update
  package engine declarations and library build targets to the new floor, and
  verify installed consumers on Node 22.21.0. Upgrade older Node installations
  before installing these releases. The repository development pin remains 24.22.0.

## 0.0.0-alpha.0

Initial Raypx Kit prerelease.

- Require Node 22.14+ and align the ESM build target with that runtime floor.

- Include typed column projections, explicit UPSERT mappings, parameterized JSONB expressions,
  postgres.js uniqueness classification, result helpers and sanitized EXPLAIN diagnostics.
- Keep Drizzle external as an optional peer: error and result helpers work without it;
  ORM-backed entries require an explicit installation. Consumers install postgres.js and own connections.
- Retain upstream inventories and plans as documentation, with complete licenses and provenance.
- Normalize Drizzle query builders through their public SQL before EXPLAIN, preserving
  bound parameters and valid syntax for write statements.
- Use dependency ranges, restrict Drizzle to the tested RC5 family, and align
  the resolved coverage provider with Vite+'s bundled Vitest.
