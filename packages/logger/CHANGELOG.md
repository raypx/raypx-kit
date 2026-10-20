# @raypx-kit/logger

## 0.0.0-alpha.1

### Patch Changes

- 5e0caaf: Add `@raypx-kit/logger/safe`, an explicit field policy for drains that removes credentials, personal data, messages, causes and stacks and bounds each event, and `@raypx-kit/logger/stream`, an ordered JSON-lines drain for stderr or another writable.

## 0.0.0-alpha.0

Initial Raypx Kit prerelease.

- Require Node 22.14+ and align the ESM build target with that runtime floor.

- Expose evlog structured logging, wide events and actionable errors.
- Provide Node request context helpers and drain batching, retries and flushing.
