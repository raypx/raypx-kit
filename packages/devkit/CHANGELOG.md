# @raypx-kit/devkit

## 0.0.0-alpha.6

### Patch Changes

- 0a2da1d: Add portable VP task models, argument isolation, cache snapshots, incremental verification policies and a scoped TanStack Start environment adapter. Preserve existing Devkit entries and Node compatibility.

## 0.0.0-alpha.5

### Patch Changes

- 069e9e7: Update Devkit's TypeScript parser to oxc-parser 0.156 and support esbuild 0.28.2
  in the slim Drizzle CLI while retaining upstream's dependency range. Rebuild the
  email preview interface with Vite+ 1.4 and verify packaged migration generation
  under Bun and Node.

## 0.0.0-alpha.4

### Patch Changes

- bbd43d1: Update compatible dependencies: PostHog in Analytics, confbox in Devkit, the bundled
  CLI dependencies in Drizzle Kit, React Email render in Email Preview, evlog in Logger
  and Nosecone in Security. Public interfaces and peer ranges are unchanged.

## 0.0.0-alpha.3

### Patch Changes

- 0b904b6: Republish through the CI release pipeline with npm provenance. No functional changes.

## 0.0.0-alpha.2

### Minor Changes

- 5515e5f: Support Bun-only repository toolchain checks and active runtime validation without
  requiring Node pins. Preserve the existing Node/Bun defaults. Export independent
  Vite+ lint presets and plain Bun test defaults for consumer-owned configuration.

## 0.0.0-alpha.1

### Major Changes

- a6af9fe: Raise the minimum supported Node.js version from 22.14.0 to 22.21.0. Update
  package engine declarations and library build targets to the new floor, and
  verify installed consumers on Node 22.21.0. Upgrade older Node installations
  before installing these releases. The repository development pin remains 24.22.0.

### Patch Changes

- a6af9fe: Allow apps and tooling to import explicitly bundled internal workspaces declared in development dependencies. Keep public export boundaries, platform compatibility, application restrictions and dependency cycle checks in force.
- 53ce687: Update compatible PostHog and dotenvx dependencies and the bundled ICU message
  parser, preserving existing public interfaces and peer compatibility.

## 0.0.0-alpha.0

Initial Raypx Kit prerelease.

- Refresh compatible dependencies and use caret ranges for ordinary dependencies;
  keep the coverage provider synchronized with Vite+'s bundled Vitest.
- Provide configurable workspace discovery, import resolution and architecture checks.
- Name non-exported implementation paths `internalPath` in import resolution and
  report internal cross-workspace imports consistently.
- Check publishable workspaces and explicit source-entry mappings before builds,
  with narrowly declared bundled development dependencies.
- Accept complete workspace metadata maps for explicit, typed repository
  configuration while retaining manifest metadata compatibility and synchronous,
  non-executing discovery.
- Check Node and Bun version-file declarations in local composite actions under
  `.github/actions/`, including nested action directories and both YAML filename extensions.
- Include Node/Bun toolchain checks, static catalog reading, Markdown link checks,
  dotenv-aware process and Turbo helpers, and relocated artifact staging and probes.
- Preserve independent entry points and consumer-owned repository policy.
