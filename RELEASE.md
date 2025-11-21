# Release Guide

This document describes how to release new versions of Raypx Kit packages.

## 📋 Prerequisites

Before releasing, ensure you have:

1. **npm Account**: Access to publish `@raypx/*` packages
2. **npm Token**: Set `NPM_TOKEN` as a GitHub secret
3. **GitHub Access**: Push access to the repository
4. **Local Setup**: All dependencies installed and tests passing

## 🔑 First-Time Setup

### 1. Configure npm Token

```bash
# Login to npm
npm login

# Generate an automation token at:
# https://www.npmjs.com/settings/[your-username]/tokens

# Add it as a GitHub secret:
# Repository Settings → Secrets → Actions → New repository secret
# Name: NPM_TOKEN
# Value: [your-token]
```

### 2. Configure GitHub Token

The `GITHUB_TOKEN` is automatically provided by GitHub Actions, no setup needed.

## 📦 Release Process

We use [Changesets](https://github.com/changesets/changesets) for version management. The process is fully automated via GitHub Actions.

### Step 1: Create a Changeset

When you make changes that affect the published packages, create a changeset:

```bash
pnpm changeset
```

You'll be prompted:

1. **Select packages**: Choose which packages to version (Space to select, Enter to confirm)
   ```
   ◯ @raypx/env
   ◯ @raypx/i18n
   ```

2. **Choose version bump**: Select the type of change
   - `patch` (0.0.1 → 0.0.2): Bug fixes
   - `minor` (0.0.1 → 0.1.0): New features (backward compatible)
   - `major` (0.0.1 → 1.0.0): Breaking changes

3. **Write summary**: Describe your changes
   ```
   Summary: Add support for custom client prefix
   ```

This creates a file in `.changeset/` directory:

```markdown
---
"@raypx/env": minor
---

Add support for custom client prefix
```

### Step 2: Commit and Push

```bash
git add .
git commit -m "feat: add custom client prefix support"
git push origin main
```

### Step 3: Automated Release

Once pushed to `main`, GitHub Actions will:

1. **Run CI**: Tests, type checking, and build
2. **Create Version PR**: Changesets bot creates a "Version Packages" PR
   - Updates package versions
   - Updates CHANGELOG.md files
   - Removes changeset files

### Step 4: Review and Merge Version PR

1. Review the generated PR
2. Check version bumps are correct
3. Review CHANGELOG updates
4. Merge the PR

### Step 5: Automatic Publish

After merging the version PR, GitHub Actions will:

1. Build packages
2. Publish to npm
3. Create GitHub releases
4. Tag the repository

## 🎯 Example Workflows

### Example 1: Bug Fix Release

```bash
# Make your fix
git checkout -b fix/validation-error
# ... make changes ...

# Create changeset
pnpm changeset
# Select: @raypx/env
# Type: patch
# Summary: Fix validation error for optional env vars

# Commit and push
git add .
git commit -m "fix: resolve validation error"
git push origin fix/validation-error

# Create PR and merge
# Wait for automatic release
```

### Example 2: New Feature Release

```bash
# Implement feature
git checkout -b feature/i18n-plurals
# ... make changes ...

# Create changeset
pnpm changeset
# Select: @raypx/i18n
# Type: minor
# Summary: Add pluralization support

# Commit and push
git add .
git commit -m "feat: add pluralization support"
git push origin feature/i18n-plurals

# Create PR and merge
# Wait for automatic release
```

### Example 3: Breaking Change Release

```bash
# Make breaking changes
git checkout -b breaking/new-api
# ... make changes ...

# Create changeset
pnpm changeset
# Select: @raypx/env
# Type: major
# Summary: BREAKING: Redesign env validation API

# Commit and push
git add .
git commit -m "feat!: redesign env validation API"
git push origin breaking/new-api

# Create PR and merge
# Wait for automatic release
```

## 🔍 Manual Release (Emergency)

If you need to publish manually (CI is down, urgent hotfix):

```bash
# 1. Ensure you're on main and up-to-date
git checkout main
git pull

# 2. Create changeset
pnpm changeset

# 3. Version packages
pnpm changeset:version

# 4. Build packages
pnpm build

# 5. Commit version changes
git add .
git commit -m "chore: release packages"
git push

# 6. Publish to npm
pnpm changeset publish

# 7. Push tags
git push --follow-tags
```

## 📝 Version Guidelines

### Semantic Versioning

We follow [SemVer](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
  - API changes
  - Removed features
  - Changed behavior

- **MINOR** (1.0.0 → 1.1.0): New features
  - New functionality
  - Backward compatible

- **PATCH** (1.0.0 → 1.0.1): Bug fixes
  - Bug fixes
  - Performance improvements
  - Documentation updates

### Pre-1.0.0 Versioning

During initial development (0.x.y):
- Breaking changes: Bump minor (0.1.0 → 0.2.0)
- New features: Bump minor (0.1.0 → 0.1.1)
- Bug fixes: Bump patch (0.1.0 → 0.1.1)

## 🚨 Troubleshooting

### Changeset Not Created

**Problem**: `pnpm changeset` does nothing

**Solution**:
```bash
# Ensure you're in the root directory
cd /path/to/raypx-kit

# Check if changeset is installed
pnpm list @changesets/cli
```

### Version PR Not Created

**Problem**: GitHub Actions ran but no PR was created

**Solutions**:
1. Check if there are changesets in `.changeset/` directory
2. Check GitHub Actions logs
3. Ensure `GITHUB_TOKEN` has proper permissions

### Publish Failed

**Problem**: Package failed to publish to npm

**Solutions**:
1. **Check npm token**: Ensure `NPM_TOKEN` secret is set
2. **Check package name**: Verify `@raypx/*` scope is available
3. **Check version**: Ensure version doesn't already exist
4. **Manual publish**: Try publishing manually (see above)

### Published Wrong Version

**Problem**: Accidentally published wrong version

**Solutions**:

⚠️ **DO NOT unpublish** (breaks existing users)

Instead:
1. Immediately publish a fixed version
2. Deprecate the bad version:
   ```bash
   npm deprecate @raypx/env@0.0.5 "Accidental publish, use 0.0.6 instead"
   ```

## 📊 Release Checklist

Before merging version PR:

- [ ] All CI checks pass
- [ ] Version bumps are correct
- [ ] CHANGELOG entries are accurate
- [ ] No uncommitted changes
- [ ] Tests pass locally
- [ ] Documentation is updated

After release:

- [ ] Packages are on npm
- [ ] GitHub release is created
- [ ] Tags are pushed
- [ ] Announcement tweet/post (optional)
- [ ] Update dependent projects

## 🔗 Useful Links

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Semantic Versioning](https://semver.org/)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## 📞 Need Help?

- **Questions**: Open a [Discussion](https://github.com/raypx/raypx-kit/discussions)
- **Issues**: Report on [GitHub Issues](https://github.com/raypx/raypx-kit/issues)
- **Urgent**: Email support@raypx.com
