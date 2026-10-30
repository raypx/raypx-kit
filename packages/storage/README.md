# @raypx-kit/storage

Object storage behind one interface, with drivers for S3-compatible services
(AWS S3, Cloudflare R2, MinIO), a local directory and memory. Clients upload and
download through short-lived signed URLs, so file bytes never pass through the
application server.

```sh
bun add @raypx-kit/storage
```

ESM only, for Node 22.21+, Bun and Cloudflare Workers (every entry except `./fs`). Server-side: drivers hold credentials or
signing secrets. Nothing reads environment variables or creates clients at import;
applications pass every option.

| Entry    | Purpose                                                            |
| -------- | ------------------------------------------------------------------ |
| .        | createStorage, policies, key validation, StorageError and types    |
| ./s3     | createS3Driver for S3-compatible services, signed with SigV4       |
| ./fs     | createFileSystemDriver for a local directory                       |
| ./memory | createMemoryDriver for tests and development                       |
| ./signed | createLocalSigner and createSignedRequestHandler for fs and memory |

## Storage and policy

```ts
import { createStorage } from "@raypx-kit/storage";
import { createS3Driver } from "@raypx-kit/storage/s3";

const storage = createStorage(
  createS3Driver({
    endpoint: "https://<account>.r2.cloudflarestorage.com",
    bucket: "uploads",
    region: "auto",
    accessKeyId,
    secretAccessKey,
  }),
  { maxSize: 20 * 1024 * 1024, contentTypes: ["image/*", "application/pdf"] },
);

await storage.put("users/42/avatar.png", bytes, { contentType: "image/png" });
const object = await storage.get("users/42/avatar.png"); // { info, body: ReadableStream } | null
const info = await storage.head("users/42/avatar.png"); // ObjectInfo | null
await storage.delete("users/42/avatar.png"); // missing objects are not an error
const page = await storage.list({ prefix: "users/42/", limit: 100 });
const next = page.cursor && (await storage.list({ prefix: "users/42/", cursor: page.cursor }));
```

Bodies are `Uint8Array`, `ArrayBuffer`, `Blob`, `string` or a byte
`ReadableStream`. `ObjectInfo` has `key`, `size`, optional `contentType`, `etag`
and `lastModified`, and string `metadata`. Lists return keys in ascending order;
S3 lists omit content types and metadata, so call `head` when they matter.

| Policy           | Default | Effect                                                         |
| ---------------- | ------- | -------------------------------------------------------------- |
| maxSize          | none    | Rejects larger bodies and signed uploads; caps unknown streams |
| contentTypes     | any     | Exact types or families such as image/\*; type then required   |
| defaultExpiresIn | 900     | Signed URL lifetime in seconds                                 |
| maxExpiresIn     | 3600    | Longest lifetime a caller may request                          |
| now              | Date    | Clock for signed URL expiry                                    |

Keys are relative slash-separated paths of at most 1024 UTF-8 bytes, without a
leading slash, empty, `.` or `..` segments, backslashes or control characters.
They are not authorization: derive them from the authenticated user on the
server, never from a client path.

Failures throw `StorageError` with a `code`: `INVALID_KEY`, `INVALID_OPTIONS`,
`TOO_LARGE`, `CONTENT_TYPE`, `SIGNING_UNAVAILABLE` or `REMOTE`. Remote messages
carry the status and S3 error code, never request credentials.

## Signed uploads and downloads

```ts
const upload = await storage.signUpload("users/42/report.pdf", {
  contentType: "application/pdf",
  size: file.size,
  expiresIn: 300,
});
// Client side:
await fetch(upload.url, { method: upload.method, headers: upload.headers, body: file });

const download = await storage.signDownload("users/42/report.pdf", { filename: "报告.pdf" });
```

Upload signatures bind the method, key, content type and exact byte length, so a
client cannot exceed the size the server approved. Clients must send the returned
headers unchanged. Downloads may set a suggested filename, sent as an RFC 6266
`Content-Disposition`.

S3 drivers presign natively. For S3 browser uploads, allow `PUT` and the
`content-type` header in the bucket's CORS rules.

### Filesystem and memory

These drivers sign with HMAC-SHA256. Mount the handler at the signer's `baseUrl`
in any Fetch-compatible server:

```ts
import { createStorage } from "@raypx-kit/storage";
import { createFileSystemDriver } from "@raypx-kit/storage/fs";
import { createLocalSigner, createSignedRequestHandler } from "@raypx-kit/storage/signed";

const signer = createLocalSigner({ secret, baseUrl: "https://api.example.com/files" });
const driver = createFileSystemDriver({ root: "/var/lib/app/storage", signer });
export const storage = createStorage(driver, { maxSize: 10 * 1024 * 1024 });
export const handleFiles = createSignedRequestHandler(driver, signer);
```

The secret must be at least 32 bytes. The handler rejects unsigned, tampered,
expired and wrong-method requests (403, 405), other content types (403) and
bodies of another size (403, or 413 when larger). Without a `signer`, signing
throws `SIGNING_UNAVAILABLE`.

The filesystem driver stores objects at `root/objects/<key>` and metadata at
`root/meta/<key>.json`, writes through a temporary file and rename with `0600`
permissions, and keeps the previous object when a write fails. A key cannot be
both an object and a prefix (`a` and `a/b`); that throws `INVALID_KEY`.

## S3 options

| Option          | Description                                                      |
| --------------- | ---------------------------------------------------------------- |
| endpoint        | Service origin, e.g. https\://s3.us-east-1.amazonaws.com         |
| bucket          | Bucket name                                                      |
| region          | Signing region; auto for R2                                      |
| accessKeyId     | Access key                                                       |
| secretAccessKey | Secret key                                                       |
| sessionToken    | Optional temporary credentials                                   |
| forcePathStyle  | true (default) for endpoint/bucket/key; false for virtual-hosted |
| fetch           | Optional fetch implementation                                    |

Server-side `put` buffers the body before sending, since S3 requires a known
length. Large files should go through signed uploads. Multipart uploads are not
yet supported.

## Testing

Use `createMemoryDriver()` in unit tests. It copies bodies and metadata, so
callers cannot change stored objects by mutating their inputs.
