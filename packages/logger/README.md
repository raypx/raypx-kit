# @raypx/logger

Lightweight, configurable logger based on [consola](https://github.com/unjs/consola).

## Features

- ✅ Based on consola with rich formatting
- ✅ Environment-aware log levels (production vs development)
- ✅ Silent mode support
- ✅ Replaceable logger instance for testing
- ✅ Tagged logger support for module-specific logging
- ✅ Proxy-based API for dynamic logger replacement
- ✅ TypeScript support with full type definitions

## Installation

```bash
npm install @raypx/logger
# or
pnpm add @raypx/logger
# or
yarn add @raypx/logger
```

## Usage

### Basic Usage

```typescript
import { logger } from "@raypx/logger";

logger.log("Hello, world!");
logger.info("Information message");
logger.warn("Warning message");
logger.error("Error message");
logger.debug("Debug message");
logger.success("Success message");
```

### Creating Tagged Loggers

Create module-specific loggers with tags:

```typescript
import { createConsola } from "@raypx/logger";

const moduleLogger = createConsola({
  level: 4,
  formatOptions: {
    colors: true,
    date: false,
    compact: true,
  },
}).withTag("MyModule");

moduleLogger.info("Module-specific log");
// Output: [MyModule] Module-specific log
```

### Silent Mode

Temporarily suppress non-error logs:

```typescript
import { logger, setSilentMode } from "@raypx/logger";

setSilentMode(true);
logger.info("This won't be shown");
logger.error("But errors will still be shown");

setSilentMode(false);
logger.info("Now info logs are visible again");
```

### Custom Logger Instance

Replace the global logger for testing or custom configurations:

```typescript
import { setLogger, createConsola } from "@raypx/logger";

const customLogger = createConsola({
  level: 0, // Silent
  formatOptions: {
    colors: false,
    date: false,
    compact: true,
  },
});

setLogger(customLogger);
```

### Get Current Logger

Access the underlying logger instance:

```typescript
import { getLogger } from "@raypx/logger";

const currentLogger = getLogger();
console.log("Current log level:", currentLogger.level);
```

## API Reference

### `logger`

Global logger instance (Proxy). Delegates all calls to the current logger instance.

```typescript
logger.log(...args: any[]): void
logger.info(...args: any[]): void
logger.warn(...args: any[]): void
logger.error(...args: any[]): void
logger.debug(...args: any[]): void
logger.success(...args: any[]): void
logger.trace(...args: any[]): void
logger.fatal(...args: any[]): void
```

### `getLogger()`

Returns the current logger instance.

```typescript
function getLogger(): ConsolaInstance
```

### `setLogger(newLogger)`

Replaces the global logger instance. Useful for testing or custom configurations.

```typescript
function setLogger(newLogger: ConsolaInstance): void
```

### `setSilentMode(silent)`

Enables or disables silent mode. In silent mode, only error messages are shown (level 1).

```typescript
function setSilentMode(silent: boolean): void
```

### `createConsola(options?)`

Creates a new consola logger instance. Re-exported from consola.

```typescript
function createConsola(options?: Partial<ConsolaOptions>): ConsolaInstance
```

### Types

```typescript
import type { Logger } from "@raypx/logger";
// Logger is an alias for ConsolaInstance
```

## Log Levels

Consola supports the following log levels:

| Level | Name  | Description                        |
|-------|-------|------------------------------------|
| 0     | silent| No output                          |
| 1     | error | Only errors                        |
| 2     | warn  | Errors + warnings                  |
| 3     | info  | Errors + warnings + info           |
| 4     | debug | Errors + warnings + info + debug   |

**Default levels:**
- Production (`NODE_ENV=production`): Level 3 (info)
- Development: Level 4 (debug)

## Environment Variables

The logger respects the `NODE_ENV` environment variable:

- `NODE_ENV=production`: Sets log level to 3 (info)
- Other values: Sets log level to 4 (debug)

## Examples

### Example 1: Application Logging

```typescript
import { logger } from "@raypx/logger";

async function startServer() {
  logger.info("Starting server...");

  try {
    await initializeDatabase();
    logger.success("Database connected");

    await startHttpServer();
    logger.success("Server started on port 3000");
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}
```

### Example 2: Module-Specific Logging

```typescript
import { createConsola } from "@raypx/logger";

// Analytics module
const analyticsLogger = createConsola({
  level: 3,
  formatOptions: { compact: true },
}).withTag("Analytics");

analyticsLogger.info("Tracking event:", { event: "page_view" });

// Billing module
const billingLogger = createConsola({
  level: 3,
  formatOptions: { compact: true },
}).withTag("Billing");

billingLogger.warn("Payment failed:", { orderId: "12345" });
```

### Example 3: Testing with Custom Logger

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { setLogger, createConsola, logger } from "@raypx/logger";

describe("MyService", () => {
  beforeEach(() => {
    // Use silent logger in tests
    const silentLogger = createConsola({ level: 0 });
    setLogger(silentLogger);
  });

  it("should not produce console output", () => {
    logger.info("This won't appear in test output");
    // Your test logic...
  });
});
```

## License

Apache-2.0 © [Raypx Team](https://github.com/raypx)

## Links

- [GitHub Repository](https://github.com/raypx/raypx-kit)
- [Issue Tracker](https://github.com/raypx/raypx-kit/issues)
- [Consola Documentation](https://github.com/unjs/consola)
