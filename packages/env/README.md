# @raypx/env

Type-safe environment variable validation with configurable client prefix and extends support.

Built on top of [envin](https://github.com/nicepkg/envin) with additional features for multi-framework support.

## Key Features

- **Typesafe environment variables** - Full TypeScript support with autocompletion
- **Configurable client prefix** - Works with Vite (`VITE_`), Next.js (`NEXT_PUBLIC_`), Nuxt (`NUXT_PUBLIC_`), and custom prefixes
- **Extends support** - Merge multiple environment configurations using the `extends` option
- **Runtime validation** - Validates environment variables at runtime using Zod
- **Framework agnostic** - Works with any JavaScript/TypeScript project
- **Standard Schema compliant** - Works with Zod, Valibot, and other validators

## Installation

```bash
# npm
npm install @raypx/env

# pnpm
pnpm add @raypx/env

# yarn
yarn add @raypx/env
```

## Basic Usage

### Vite Project (Default)

```typescript
import { createEnv, z } from "@raypx/env";

const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_KEY: z.string().min(1),
  },
  client: {
    VITE_APP_URL: z.string().url(),
  },
});

// Type-safe access
console.log(env.DATABASE_URL);
console.log(env.VITE_APP_URL);
```

### Next.js Project

```typescript
import { createEnv, z, CLIENT_PREFIXES } from "@raypx/env";

const env = createEnv({
  clientPrefix: CLIENT_PREFIXES.NEXT, // "NEXT_PUBLIC_"
  server: {
    DATABASE_URL: z.string().url(),
    API_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
});
```

### Nuxt Project

```typescript
import { createEnv, z, CLIENT_PREFIXES } from "@raypx/env";

const env = createEnv({
  clientPrefix: CLIENT_PREFIXES.NUXT, // "NUXT_PUBLIC_"
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    NUXT_PUBLIC_API_URL: z.string().url(),
  },
});
```

### Custom Prefix

```typescript
import { createEnv, z } from "@raypx/env";

const env = createEnv({
  clientPrefix: "PUBLIC_",
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    PUBLIC_APP_URL: z.string().url(),
  },
});
```

## Extends Feature

The `extends` option allows you to merge multiple environment configurations:

```typescript
import { createEnv, z } from "@raypx/env";

// Base configuration
const baseConfig = {
  NODE_ENV: z.enum(["development", "production", "test"]),
};

// Database configuration
const dbConfig = {
  DATABASE_URL: z.string().url(),
  DB_POOL_SIZE: z.string().transform((val) => parseInt(val, 10)),
};

// API configuration
const apiConfig = {
  API_BASE_URL: z.string().url(),
  API_TIMEOUT: z.string().transform((val) => parseInt(val, 10)),
};

// Merge all configurations
const env = createEnv({
  server: baseConfig,
  extends: [dbConfig, apiConfig],
});

// Now env has all properties from baseConfig, dbConfig, and apiConfig
console.log(env.DATABASE_URL); // Type-safe access
console.log(env.API_BASE_URL); // Type-safe access
```

## API Reference

### `createEnv(options)`

Creates a new environment variable schema.

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `server` | `object` | Server-side environment variables schema |
| `client` | `object` | Client-side environment variables schema |
| `shared` | `object` | Shared environment variables (available on both) |
| `extends` | `array` | Array of additional schemas to merge |
| `clientPrefix` | `string` | Prefix for client variables (default: `"VITE_"`) |
| `isServer` | `boolean` | Force server/client mode (auto-detected by default) |
| `skip` | `boolean` | Skip validation (useful for build time) |

### `CLIENT_PREFIXES`

Pre-defined client prefixes for common frameworks:

```typescript
CLIENT_PREFIXES.VITE  // "VITE_"
CLIENT_PREFIXES.NEXT  // "NEXT_PUBLIC_"
CLIENT_PREFIXES.NUXT  // "NUXT_PUBLIC_"
CLIENT_PREFIXES.EXPO  // "EXPO_PUBLIC_"
```

### `z`

Re-exported from Zod for convenience.

## Type Transforms

Transform string environment variables to other types:

```typescript
const env = createEnv({
  server: {
    PORT: z.string().transform((val) => parseInt(val, 10)),
    ENABLE_FEATURE: z.string().transform((val) => val === "true"),
    ALLOWED_ORIGINS: z.string().transform((val) => val.split(",")),
  },
});

// Types are correctly inferred
env.PORT;           // number
env.ENABLE_FEATURE; // boolean
env.ALLOWED_ORIGINS; // string[]
```

## Default Values

```typescript
const env = createEnv({
  server: {
    PORT: z.string().default("3000").transform((val) => parseInt(val, 10)),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  },
});
```

## Skip Validation

Useful during build time when environment variables may not be available:

```typescript
const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  skip: process.env.SKIP_ENV_VALIDATION === "true",
});
```

## License

Apache License 2.0 - see [LICENSE](./LICENSE) for details.
