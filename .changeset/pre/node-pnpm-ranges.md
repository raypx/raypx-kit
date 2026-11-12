---
"@raypx-kit/devkit": patch
---

Accept semver ranges for Node in the Node/pnpm toolchain policy. Runtime checks validate the active Node version against the declared range and return the actual version, while pnpm remains pinned exactly.
