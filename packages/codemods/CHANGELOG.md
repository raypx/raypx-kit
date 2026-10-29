# @raypx-kit/codemods

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

- Add a dependency-free, dry-run-first runner for explicit UTF-8 files.
- Add the `raypx-kit-codemod` CLI with an empty built-in migration registry.
- Verify public types, runner behavior and the CLI in Bun and Node consumers.
