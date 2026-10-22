# @raypx-kit/logger

```sh
bun add @raypx-kit/logger
```

Built on evlog. One **wide event** per request or job: accumulate fields, emit once.

```ts
import { initLogger, createRequestLogger } from "@raypx-kit/logger";
import { runWithLogger, useLogger } from "@raypx-kit/logger/context";

initLogger({ env: { service: "api", environment: "production" }, pretty: false });

const logger = createRequestLogger({ method: "GET", path: "/account", requestId });
await runWithLogger(logger, async () => {
  try {
    useLogger().set({ account: { found: true } }); // anywhere below
    logger.set({ status: 200 });
  } catch (error) {
    logger.error(error as Error);
    logger.set({ status: 500 });
    throw error;
  } finally {
    logger.emit();
  }
});
```

| Entry       | Use                                                                                     |
| ----------- | --------------------------------------------------------------------------------------- |
| `.`         | `initLogger`, `log`, `createLogger`, `createRequestLogger`, `createError`, `parseError` |
| `/context`  | `runWithLogger`, `getLogger`, `useLogger` (Node/Bun async context)                      |
| `/safe`     | `withEventPolicy` field allowlist and redaction; Workers-safe                           |
| `/stream`   | `createStreamDrain` for ordered JSON lines                                              |
| `/pipeline` | `createDrainPipeline` with batching and retries                                         |

## Never log secrets

```ts
import { withEventPolicy } from "@raypx-kit/logger/safe";
import { createStreamDrain } from "@raypx-kit/logger/stream";

const output = createStreamDrain();
initLogger({
  env: { service: "cli" },
  silent: true,
  drain: withEventPolicy(output, { fields: ["operation", "requestId", "status", "error"] }),
});
await output.close(); // before exit
```

Only listed fields leave the process; sensitive keys are masked at any depth and
errors keep only name and `code`. Call `initLogger` once per process; flush drains
in your shutdown handler. Strict declaration checks need `DOM` in `lib`.

Full guide: [README](https://github.com/raypx/raypx-kit/blob/canary/packages/logger/README.md)
