# @raypx-kit/devkit

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
