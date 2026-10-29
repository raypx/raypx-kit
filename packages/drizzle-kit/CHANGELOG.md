# @raypx-kit/drizzle-kit

## 0.0.0-alpha.4

### Patch Changes

- 069e9e7: Update Devkit's TypeScript parser to oxc-parser 0.156 and support esbuild 0.28.2
  in the slim Drizzle CLI while retaining upstream's dependency range. Rebuild the
  email preview interface with Vite+ 1.4 and verify packaged migration generation
  under Bun and Node.

## 0.0.0-alpha.3

### Patch Changes

- bbd43d1: Update compatible dependencies: PostHog in Analytics, confbox in Devkit, the bundled
  CLI dependencies in Drizzle Kit, React Email render in Email Preview, evlog in Logger
  and Nosecone in Security. Public interfaces and peer ranges are unchanged.

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

- Provide a slim distribution of drizzle-kit `1.0.0-rc.5-5935859`.
- Redistribute the upstream CLI, agent skills, `defineConfig` and declarations unchanged,
  omitting the unused programmatic API and payload bundles.
- Keep upstream dependency ranges and the `drizzle-kit` binary name.
- Preserve CommonJS and ESM entry points with a generated module-type boundary
  without changing upstream files or public export paths.
- Retain the synchronized exact Drizzle prerelease and upstream dependency
  declarations; align the coverage provider with Vitest `5.0.5`.
