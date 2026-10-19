# Logger

## Scope

Expose evlog's structured logging, wide events, structured errors and drain
pipeline with their native types. Keep evlog external and use only its public
exports. The Node-only `context` entry uses `evlog/toolkit/storage` to carry an
existing logger through asynchronous work. It must not pull Node built-ins into
the root entry.

## Contracts

- `initLogger` configures evlog globally; never describe it as instance-local.
  Applications initialize once at startup. Kit does not initialize on import.
- Callers own `emit()` and drain flushing. Context helpers neither emit nor
  change configuration, and nested contexts restore the parent logger.
- Preserve evlog's errors, sampling, redaction and delivery behavior. Do not add
  product environment variables, request schemas, categories or providers.
- Tests live in `tests/`; declaration contracts live in `tests/fixtures/consumer`.
  Cover concurrent and nested context isolation through public helpers and
  exercise the real external evlog package, including the packed consumer.
