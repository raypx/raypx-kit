# Raypx Kit

<p align="center">
  <strong>Essential infrastructure packages for modern web development</strong>
</p>

<p align="center">
  <a href="https://github.com/raypx/raypx-kit/actions/workflows/ci.yml">
    <img src="https://github.com/raypx/raypx-kit/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
  </a>
  <a href="https://github.com/raypx/raypx-kit/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License" />
  </a>
  <a href="https://www.npmjs.com/package/@raypx/env">
    <img src="https://img.shields.io/npm/v/@raypx/env.svg" alt="npm version" />
  </a>
  <a href="https://github.com/raypx/raypx-kit">
    <img src="https://img.shields.io/github/stars/raypx/raypx-kit?style=social" alt="GitHub stars" />
  </a>
</p>

---

## 📦 Packages

### [@raypx/env](./packages/env)

Type-safe environment variable validation powered by Zod.

```bash
npm install @raypx/env zod
```

**Features:**
- ✅ Type-safe environment variables
- ✅ Runtime validation with Zod
- ✅ Client/Server separation
- ✅ Extends support for shared configs
- ✅ Configurable client prefix

**Example:**

```typescript
import { createEnv } from '@raypx/env';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string().min(32),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});

// Fully typed!
console.log(env.DATABASE_URL); // string
console.log(env.NEXT_PUBLIC_API_URL); // string
```

---

### [@raypx/logger](./packages/logger)

Lightweight, configurable logger based on consola.

```bash
npm install @raypx/logger
```

**Features:**
- ✅ Based on consola with rich formatting
- ✅ Environment-aware log levels
- ✅ Silent mode support
- ✅ Replaceable logger instance for testing
- ✅ Tagged logger support
- ✅ TypeScript support

**Example:**

```typescript
import { logger } from '@raypx/logger';

logger.log('Hello, world!');
logger.info('Information message');
logger.warn('Warning message');
logger.error('Error message');

// Create module-specific logger
import { createConsola } from '@raypx/logger';
const moduleLogger = createConsola({ level: 4 }).withTag('MyModule');
moduleLogger.info('Module-specific log');
```

---

### [@raypx/i18n](./packages/i18n)

Vite plugin for internationalization with compile-time optimization.

```bash
npm install @raypx/i18n
```

**Features:**
- ✅ Compile-time translation injection
- ✅ TypeScript support
- ✅ Hot module replacement
- ✅ Minimal runtime overhead
- ✅ JSON-based translations

**Example:**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { i18n } from '@raypx/i18n/vite';

export default defineConfig({
  plugins: [
    i18n({
      locales: ['en', 'zh'],
      defaultLocale: 'en',
      localesDir: './locales',
    }),
  ],
});
```

```typescript
// Usage in your app
import { useTranslation } from '@raypx/i18n/runtime';

const { t, locale, setLocale } = useTranslation();

console.log(t('welcome')); // "Welcome"
setLocale('zh');
console.log(t('welcome')); // "欢迎"
```

---

## 🚀 Quick Start

### For Users

Install the package you need:

```bash
# Environment validation
npm install @raypx/env zod

# Logger
npm install @raypx/logger

# Internationalization
npm install @raypx/i18n
```

### For Contributors

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

# Type check
pnpm typecheck
```

---

## 🛠️ Development

### Available Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test             # Run tests
pnpm typecheck        # Type check

# Code Quality
pnpm format           # Format with Biome
pnpm check            # Lint with Biome
pnpm check:fix        # Fix lint issues
pnpm clean            # Clean build artifacts

# Release
pnpm changeset        # Create a changeset
pnpm changeset:version # Bump versions
pnpm release          # Publish to npm
```

### Project Structure

```
raypx-kit/
├── packages/
│   ├── env/              # @raypx/env
│   ├── logger/           # @raypx/logger
│   └── i18n/             # @raypx/i18n
├── .github/
│   └── workflows/        # CI/CD pipelines
├── .changeset/           # Version management
└── package.json          # Monorepo root
```

---

## 📖 Documentation

- **[@raypx/env Documentation](./packages/env/README.md)**
- **[@raypx/logger Documentation](./packages/logger/README.md)**
- **[@raypx/i18n Documentation](./packages/i18n/README.md)**
- **[Contributing Guide](./CONTRIBUTING.md)**
- **[Security Policy](./SECURITY.md)**

---

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code of Conduct

Be respectful, inclusive, and constructive. See our [Code of Conduct](https://github.com/raypx/.github/blob/main/CODE_OF_CONDUCT.md).

---

## 📜 License

[Apache-2.0](./LICENSE) © 2025 [Raypx Team](https://github.com/raypx)

---

## 🙏 Acknowledgments

Built with:
- [Turborepo](https://turbo.build) - Monorepo management
- [Changesets](https://github.com/changesets/changesets) - Version management
- [Biome](https://biomejs.dev) - Linting and formatting
- [tsdown](https://tsdown.vercel.app) - TypeScript bundler
- [Vitest](https://vitest.dev) - Testing framework

---

## 📞 Support

- 🐛 [Report Issues](https://github.com/raypx/raypx-kit/issues)
- 💬 [GitHub Discussions](https://github.com/raypx/raypx-kit/discussions)
- 🔒 [Security Issues](./SECURITY.md)
- 📧 [Email](mailto:support@raypx.com)

---

<p align="center">
  Made with ❤️ by the <a href="https://github.com/raypx">Raypx Team</a>
</p>
