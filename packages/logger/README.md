# @raypx-kit/logger

Structured logging and wide events powered by [evlog](https://www.evlog.dev).
Accumulate context during a request or job, then emit one event with its outcome.
The Node context helpers let deeper calls reuse that event without passing a
logger through every function.

## Install

```sh
bun add @raypx-kit/logger
```

ESM; Node 22.21+ or Bun. evlog is an external runtime dependency (`^2.33.1`), not
bundled or copied. Its framework adapters and their optional peers are not
required. The Node-only context entry uses `node:async_hooks`; the root and
pipeline entries do not import it.

For strict declaration checking (`skipLibCheck: false`), include `DOM` in your
TypeScript `lib` alongside your ES target. evlog 2's public transport types refer
to Fetch types, including `RequestCredentials`, even in a Node application.
The context entry also requires Node types.

## Start once, emit per operation

```ts
import { createLogger, initLogger } from "@raypx-kit/logger";

initLogger({
  env: { service: "sync-worker", environment: "production" },
  pretty: false,
  redact: true,
});

const logger = createLogger({ jobId: "sync-1" });
logger.set({ records: { read: 20 } });
logger.set({ records: { written: 20 } });
logger.emit(); // one JSON event, including duration and environment metadata
```

`initLogger` configures evlog globally across the process, including other copies
of evlog with the same major version. Initialize it once at application startup;
creating a logger starts a new event, not an independent output configuration.
Importing this package does not initialize logging.

## Entrypoints

| Entry                      | Exports                                                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @raypx-kit/logger          | initLogger, log, createLogger, createRequestLogger, createError, EvlogError, parseError, defineEvlog, toLoggerConfig; their configuration, event, logger, error, sampling and drain types |
| @raypx-kit/logger/context  | runWithLogger, getLogger, useLogger for Node and Bun asynchronous context                                                                                                                 |
| @raypx-kit/logger/pipeline | createDrainPipeline, DrainPipelineOptions, PipelineDrainFn                                                                                                                                |
| @raypx-kit/logger/safe     | withEventPolicy, createEventPolicy, safeError, DEFAULT_SENSITIVE_KEYS and their types; no Node APIs, so it also runs on Workers                                                           |
| @raypx-kit/logger/stream   | createStreamDrain for ordered JSON lines on stderr or another Node writable                                                                                                               |

Core functions retain evlog's native types and behavior. `defineEvlog` describes
shared configuration; pass `toLoggerConfig(config)` to `initLogger` when using a
configuration object that also contains framework settings. Kit does not load
configuration or `.env` files; evlog still detects environment metadata from
the runtime environment unless configured explicitly.

## Request context

```ts
import { createRequestLogger } from "@raypx-kit/logger";
import { runWithLogger, useLogger } from "@raypx-kit/logger/context";

async function loadAccount() {
  useLogger().set({ account: { found: true } });
}

const logger = createRequestLogger({
  method: "GET",
  path: "/account",
  requestId: "req-1",
});

await runWithLogger(logger, async () => {
  try {
    await loadAccount();
    logger.set({ status: 200 });
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(String(error)));
    logger.set({ status: 500 });
    throw error;
  } finally {
    logger.emit();
  }
});
```

- `runWithLogger(logger, callback)` returns the callback's value or promise and
  propagates its errors. Concurrent calls are isolated; nested calls restore the
  parent logger when they return.
- `getLogger()` returns the current logger or `undefined` outside a bound scope.
- `useLogger()` returns it or throws outside a bound scope. Its optional generic
  type parameter preserves application field types.

Context helpers only bind a logger. The caller owns errors, `emit()` and request
completion, including streamed responses. They never emit, merge parent fields
or reconfigure evlog. Storage is shared under `@raypx-kit/logger/context`, so
separate installed copies of this package can read the same bound scope.

## Typed fields and errors

```ts
import { createError, createLogger, parseError } from "@raypx-kit/logger";

const logger = createLogger<{ records: { read: number; written: number } }>({
  records: { read: 20 },
});
logger.set({ records: { written: 18 } });

const error = createError({
  message: "Sync failed",
  status: 503,
  why: "Destination unavailable",
  fix: "Retry the job after the destination recovers",
});
logger.error(error);
logger.emit();

const { message, status, why, fix } = parseError(error);
```

`set` merges object fields and appends arrays. `error` attaches a structured error
and raises the event severity. `emit(overrides?)` returns a `WideEvent` or `null`
when sampling drops it, and seals the event in either case. Create a new logger
for the next operation.

For individual messages, use structured objects, for example
`log.info({ action: 'worker.started' })`. This keeps events on the same drain and
redaction path. evlog's pretty string/tag form bypasses that path.

## Allowed fields and redaction

Applications that must never log credentials, personal data or file contents can
wrap their drain with an explicit field policy. Only the envelope (`timestamp`,
`level`, `service`, `environment`) and the listed fields leave the process:

```ts
import { initLogger } from "@raypx-kit/logger";
import { withEventPolicy } from "@raypx-kit/logger/safe";
import { createStreamDrain } from "@raypx-kit/logger/stream";

const output = createStreamDrain(); // JSON lines on stderr
initLogger({
  env: { service: "cli", environment: "production" },
  silent: true,
  drain: withEventPolicy(output, {
    fields: ["operation", "requestId", "status", "durationMs", "error", "rpc"],
    shapes: { rpc: ["system", "method"] },
  }),
});

// Before exit:
await output.close();
```

- Values of sensitive keys (passwords, tokens, cookies, headers, bodies, messages,
  stacks, paths, commands, URLs, e-mail addresses and similar) are replaced at any
  depth; strings are shortened and URLs, bearer tokens, JWTs and e-mail addresses
  inside them are masked. Pass `sensitiveKeys` to replace the default pattern.
- `error` keeps only a standard error name and a machine `code`; messages, causes
  and stacks never leave the process.
- `shapes` keeps selected string properties of framework objects.
- Each event is limited to `maxEventBytes` (16 KiB by default); fields beyond the
  limit are dropped in the order they are listed. Getters, `toJSON`, cycles and
  hostile proxies are never invoked or followed.
- Request metadata and headers in the drain context are not forwarded.

`createStreamDrain` writes in order, never ends a stream it did not create, drops
events beyond `maxPending` (1024) and reports write or serialization failures once
from `flush()` or `close()`, never from the code that emitted the event.

## Drains, batching and shutdown

```ts
import { initLogger, type DrainContext } from "@raypx-kit/logger";
import { createDrainPipeline } from "@raypx-kit/logger/pipeline";

const drain = createDrainPipeline<DrainContext>({
  batch: { size: 50, intervalMs: 5000 },
  retry: { maxAttempts: 3 },
})(async (batch) => {
  await sendToYourBackend(batch);
});

initLogger({
  env: { service: "api" },
  silent: true, // the drain owns output
  redact: { paths: ["credentials.password", "headers.authorization"] },
  drain,
});

// In the application's shutdown handler, after request processing stops:
await drain.flush();
```

Drains run asynchronously; `emit()` does not wait for delivery. The pipeline
batches, retries and bounds its buffer. `flush()` waits for buffered work to be
delivered or dropped, `settled()` waits without forcing an early flush, and
`pending` counts buffered events, excluding batches already being delivered. Use `onDropped` to observe exhausted retries
or buffer overflow. Applications own shutdown and delivery policy.

Sampling, levels, JSON/pretty output and redaction use evlog's configuration.
Redaction applies before console output and drains for structured/wide events;
enrichers must sanitize fields they add afterward. See the upstream
[configuration](https://www.evlog.dev/reference/configuration),
[redaction](https://www.evlog.dev/learn/redaction) and
[pipeline](https://www.evlog.dev/extend/drain-pipeline) guides for option details.

## Development

```sh
bun run --cwd packages/logger test
bun run --cwd packages/logger check
bun run build --filter=@raypx-kit/logger
bun run pack:check
```

Tests exercise real evlog events, redaction, sampling, pipeline delivery and
concurrent context isolation. The archive consumer checks public declarations
and runs the same context/drain contract in both Bun and Node outside the repo.
