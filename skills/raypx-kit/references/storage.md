# @raypx-kit/storage

```sh
bun add @raypx-kit/storage
```

Server-side object storage. Clients upload/download through short-lived signed URLs.

```ts
import { createStorage } from "@raypx-kit/storage";
import { createS3Driver } from "@raypx-kit/storage/s3";

const storage = createStorage(
  createS3Driver({ endpoint, bucket: "uploads", region: "auto", accessKeyId, secretAccessKey }),
  { maxSize: 20 * 1024 * 1024, contentTypes: ["image/*", "application/pdf"] },
);

const upload = await storage.signUpload(`users/${userId}/report.pdf`, {
  contentType: "application/pdf",
  size: file.size,
});
// client: fetch(upload.url, { method: upload.method, headers: upload.headers, body: file })
```

| Entry     | Driver                                                           |
| --------- | ---------------------------------------------------------------- |
| `/s3`     | AWS S3, Cloudflare R2, MinIO (SigV4 presign)                     |
| `/fs`     | Local directory (Node only); needs a signer for URLs             |
| `/memory` | Tests and development                                            |
| `/signed` | `createLocalSigner` + `createSignedRequestHandler` for fs/memory |

- Derive keys from the authenticated user on the server; keys are not authorization.
- Upload signatures bind method, key, content type and exact size.
- S3 browser uploads need CORS allowing `PUT` and `content-type`.
- Errors are `StorageError` with codes like `TOO_LARGE`, `CONTENT_TYPE`, `INVALID_KEY`.
- Large server-side `put`s buffer the body; prefer signed uploads. No multipart yet.

Full guide: [README](https://github.com/raypx/raypx-kit/blob/canary/packages/storage/README.md)
