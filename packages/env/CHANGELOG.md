# @raypx-kit/env

## 0.0.0-alpha.0

Initial Raypx Kit prerelease.

- Require Node 22.14+ and align the ESM build target with that runtime floor.

- Refresh compatible dependencies and use caret ranges for ordinary dependencies;
  keep the coverage provider synchronized with Vite+'s bundled Vitest.
- Provide typed `createEnv` and `defineEnv` with nested presets, later schema overrides,
  inferred output types, blank-value normalization, defaults, transforms and error hooks.
- Include the `InferEnv` type helper, guarded browser access and the `/runtime` NODE_ENV preset.
- Keep Zod 4 external as a required peer so consumer schemas share one runtime.
