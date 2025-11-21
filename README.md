# Raypx Kit

Essential infrastructure packages for Raypx projects.

## Packages

- **[@raypx/env](./packages/env)** - Environment variable validation with Zod
- **[@raypx/i18n](./packages/i18n)** - Vite plugin for internationalization

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## Development

```bash
# Format code
pnpm format

# Lint code
pnpm lint:fix

# Clean build artifacts
pnpm clean
```

## Release

```bash
# Create a changeset
pnpm changeset

# Version packages
pnpm changeset:version

# Publish to npm
pnpm release
```

## License

Apache-2.0
