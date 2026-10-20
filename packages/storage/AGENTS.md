# @raypx-kit/storage

## Purpose

Object storage drivers and signed URLs for server code. Applications own
buckets, credentials, key layout and authorization.

## Interface

| Path       | Purpose                                                     |
| ---------- | ----------------------------------------------------------- |
| `.`        | `createStorage`, policies, key validation, errors and types |
| `./s3`     | S3-compatible driver signed with SigV4 through aws4fetch    |
| `./fs`     | Local directory driver with atomic writes                   |
| `./memory` | In-memory driver for tests                                  |
| `./signed` | HMAC signer and Fetch handler for the fs and memory drivers |

The README documents the complete shipped API.

## Constraints

- No environment variables, singletons or network at import.
- Drivers implement `StorageDriver`; validation stays in `createStorage`.
- Signed uploads always bind content type and exact size.
- Never include credentials, signatures or object bytes in errors.
- Every driver passes `tests/helpers/conformance.ts`; S3 tests use a local fake server.
- Entries other than `./fs` run on Node, Bun and Workers: no `Buffer` or other
  Node-only APIs. Use `src/internal/encoding.ts` for byte encodings.
- Do not import other Raypx Kit packages.

## Verification

```bash
bun run --cwd packages/storage test
bun run --cwd packages/storage check
bun run build --filter=@raypx-kit/storage
bun run --cwd packages/storage pack:check
```
