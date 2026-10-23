# @raypx-kit/intl

## 0.0.0-alpha.1

### Major Changes

- a6af9fe: Raise the minimum supported Node.js version from 22.14.0 to 22.21.0. Update
  package engine declarations and library build targets to the new floor, and
  verify installed consumers on Node 22.21.0. Upgrade older Node installations
  before installing these releases. The repository development pin remains 24.22.0.

### Patch Changes

- 53ce687: Update compatible PostHog and dotenvx dependencies and the bundled ICU message
  parser, preserving existing public interfaces and peer compatibility.

## 0.0.0-alpha.0

Initial Raypx Kit prerelease.

- Require Node 22.14+ and align the ESM build target with that runtime floor.

- Provide configurable locale negotiation, typed ICU translation and native formatting.
- Include controlled `IntlProvider` and `LanguageProvider`, browser preference adapters,
  structural server hints, error-code translation and catalog parity tooling.
- Preserve upstream namespace, key and ICU-value inference and hydration behavior.
- Bundle use-intl 4.14.9 and its FormatJS dependencies with their licenses; keep React 19 external.
- Refresh verification dependencies to React 19.3.1 and jsdom 30.1.3, use caret
  ranges for ordinary dependencies and keep coverage aligned with bundled Vitest.
