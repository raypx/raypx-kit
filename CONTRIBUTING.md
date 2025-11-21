# Contributing to Raypx Kit

Thank you for your interest in contributing to Raypx Kit! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Versioning and Releases](#versioning-and-releases)

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 10.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/raypx/raypx-kit.git
cd raypx-kit

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Project Structure

```
raypx-kit/
├── packages/
│   ├── env/              # Environment variable validation
│   └── i18n/             # Vite i18n plugin
├── .github/
│   └── workflows/        # GitHub Actions
├── .changeset/           # Changesets for versioning
└── package.json          # Root package.json
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Write clear, concise commit messages
- Follow the existing code style
- Add tests for new features
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run all checks
pnpm typecheck
pnpm test
pnpm build

# Format and lint
pnpm format
pnpm check:fix
```

### 4. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve issue"
git commit -m "docs: update README"
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test updates
- `chore`: Build process or tooling changes
- `perf`: Performance improvements

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Prefer `type` over `interface`
- Avoid `any`, use `unknown` instead
- Export types with `export type`

### Code Style

We use Biome for formatting and linting:

```bash
# Format code
pnpm format

# Lint and fix
pnpm check:fix
```

### Testing

- Write tests for all new features
- Maintain test coverage
- Use descriptive test names

```typescript
import { describe, it, expect } from 'vitest';

describe('myFunction', () => {
  it('should handle valid input', () => {
    expect(myFunction('test')).toBe('expected');
  });

  it('should throw error for invalid input', () => {
    expect(() => myFunction('')).toThrow();
  });
});
```

## Submitting Changes

### Pull Request Process

1. **Update your branch**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Push your changes**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create Pull Request**
   - Use a clear, descriptive title
   - Fill out the PR template
   - Link related issues
   - Add screenshots if applicable

4. **Code Review**
   - Address review comments
   - Keep the PR focused and small
   - Be respectful and constructive

### PR Requirements

- ✅ All tests pass
- ✅ Code is formatted with Biome
- ✅ TypeScript compilation succeeds
- ✅ Documentation is updated
- ✅ Changeset is added (for features/fixes)

## Versioning and Releases

We use [Changesets](https://github.com/changesets/changesets) for versioning.

### Adding a Changeset

When you make changes that affect the published packages:

```bash
pnpm changeset
```

Follow the prompts:
1. Select packages to version
2. Choose version bump type (major/minor/patch)
3. Write a summary of changes

**When to add changesets:**
- ✅ New features (`minor`)
- ✅ Bug fixes (`patch`)
- ✅ Breaking changes (`major`)
- ❌ Documentation only
- ❌ Internal refactoring (no API changes)

### Version Bump Guidelines

- **Major (1.0.0 → 2.0.0)**: Breaking changes
- **Minor (1.0.0 → 1.1.0)**: New features (backward compatible)
- **Patch (1.0.0 → 1.0.1)**: Bug fixes

### Release Process

Releases are automated via GitHub Actions:

1. Merge PR to `main`
2. Changesets bot creates a "Version Packages" PR
3. Review and merge the version PR
4. Packages are automatically published to npm

## Package-Specific Guidelines

### @raypx/env

- Environment validation logic
- Zod schema utilities
- Must maintain backward compatibility

### @raypx/i18n

- Vite plugin functionality
- Runtime utilities
- Test with the playground (`pnpm -C packages/i18n playground`)

## Getting Help

- 📖 Read the [README](./README.md)
- 🐛 [Report bugs](https://github.com/raypx/raypx-kit/issues/new)
- 💬 Ask questions in [Discussions](https://github.com/raypx/raypx-kit/discussions)

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
