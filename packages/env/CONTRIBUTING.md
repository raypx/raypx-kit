# Contributing

## Release Process

### Stable Release

```bash
# 1. Create changeset
pnpm changeset

# 2. Update version
pnpm version

# 3. Release (build + publish to npm + create git tag + push)
pnpm release
```

### Pre-release

```bash
# 1. Enter pre-release mode (alpha/beta/rc)
pnpm pre:enter alpha

# 2. Create changeset and update version
pnpm changeset
pnpm version
# Version will be x.x.x-alpha.0

# 3. Publish pre-release
pnpm prerelease

# 4. Repeat steps 2-3 for more pre-release versions...

# 5. Exit pre-release mode when testing is complete
pnpm pre:exit

# 6. Publish stable release
pnpm changeset
pnpm version
pnpm release
```

### Installing Pre-release Versions

```bash
pnpm add @raypx/env@alpha
pnpm add @raypx/env@beta
pnpm add @raypx/env@rc
```
