# @raypx-kit/storage

## 0.0.0-alpha.1

### Major Changes

- a6af9fe: Raise the minimum supported Node.js version from 22.14.0 to 22.21.0. Update
  package engine declarations and library build targets to the new floor, and
  verify installed consumers on Node 22.21.0. Upgrade older Node installations
  before installing these releases. The repository development pin remains 24.22.0.

## 0.0.0-alpha.0

Initial prerelease.

- Add `createStorage`, which validates keys, sizes, content types, list limits and
  signed URL lifetimes before any driver runs, and caps streams of unknown length.
- Add memory, filesystem and S3-compatible drivers. The filesystem driver writes
  atomically with private permissions; the S3 driver signs with SigV4 and works
  with AWS S3, Cloudflare R2 and MinIO.
- Add presigned uploads bound to content type and exact size, and downloads with
  a suggested filename. Memory and filesystem drivers sign with HMAC through
  `createLocalSigner` and serve URLs through `createSignedRequestHandler`.
- Run every entry except `./fs` without Node's `Buffer`, so Workers need no
  `nodejs_compat` flag for storage.
