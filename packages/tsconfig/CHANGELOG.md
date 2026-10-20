# @raypx-kit/tsconfig

## 0.0.0-alpha.0

Initial Raypx Kit prerelease.

- Declare Node 22.14+ support consistently with the other public packages.

- Refresh compatible dependencies and use caret ranges for ordinary dependencies;
  keep the coverage provider synchronized with Vite+'s bundled Vitest.
- Publish the strict `base`, `node`, `browser`, `library` and `react-library` presets
  with shared strict compiler defaults.
- Keep explicit JSON exports and sibling preset references; consumers own project layout,
  path aliases, project references and runtime-specific ambient types.
