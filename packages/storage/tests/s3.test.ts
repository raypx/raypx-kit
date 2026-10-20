import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { describeDriver } from "./helpers/conformance.js";
import { createStorage, StorageError } from "../src/index.js";
import { createS3Driver, type S3DriverOptions } from "../src/s3.js";

interface FakeObject {
  bytes: Buffer;
  headers: Record<string, string>;
  modified: Date;
}

const buckets = new Map<string, Map<string, FakeObject>>();
const seen: IncomingMessage[] = [];
let server: Server;
let endpoint: string;

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Path-style S3 subset: object CRUD and ListObjectsV2 with continuation tokens. */
async function handle(
  request: IncomingMessage,
): Promise<{ status: number; headers?: Record<string, string>; body?: string | Buffer }> {
  seen.push(request);
  const url = new URL(request.url!, "http://s3.test");
  if (!request.headers.authorization?.startsWith("AWS4-HMAC-SHA256 Credential=AKID/"))
    return { status: 403, body: "<Error><Code>AccessDenied</Code></Error>" };
  const [, bucket = "", ...rest] = url.pathname.split("/");
  const key = rest.map(decodeURIComponent).join("/");
  const objects = buckets.get(bucket) ?? buckets.set(bucket, new Map()).get(bucket)!;
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  if (!key && request.method === "GET") {
    const prefix = url.searchParams.get("prefix") ?? "";
    const after = url.searchParams.get("continuation-token") ?? "";
    const max = Number(url.searchParams.get("max-keys"));
    const keys = [...objects.keys()]
      .filter((name) => name.startsWith(prefix) && name > after)
      .sort();
    const page = keys.slice(0, max);
    const truncated = keys.length > max;
    const contents = page
      .map((name) => {
        const object = objects.get(name)!;
        return `<Contents><Key>${escape(name)}</Key><LastModified>${object.modified.toISOString()}</LastModified><ETag>&quot;e${object.bytes.length}&quot;</ETag><Size>${object.bytes.length}</Size></Contents>`;
      })
      .join("");
    return {
      status: 200,
      body: `<?xml version="1.0"?><ListBucketResult><IsTruncated>${truncated}</IsTruncated>${contents}${truncated ? `<NextContinuationToken>${escape(page.at(-1)!)}</NextContinuationToken>` : ""}</ListBucketResult>`,
    };
  }
  const object = objects.get(key);
  switch (request.method) {
    case "PUT": {
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(request.headers))
        if (name === "content-type" || name.startsWith("x-amz-meta-"))
          headers[name] = String(value);
      const bytes = Buffer.concat(chunks);
      objects.set(key, { bytes, headers, modified: new Date() });
      return { status: 200, headers: { etag: `"e${bytes.length}"` } };
    }
    case "GET":
    case "HEAD":
      if (!object) return { status: 404, body: "<Error><Code>NoSuchKey</Code></Error>" };
      return {
        status: 200,
        headers: {
          ...object.headers,
          etag: `"e${object.bytes.length}"`,
          "last-modified": object.modified.toUTCString(),
          "content-length": String(object.bytes.length),
        },
        ...(request.method === "GET" ? { body: object.bytes } : {}),
      };
    case "DELETE":
      objects.delete(key);
      return { status: 204 };
    default:
      return { status: 405 };
  }
}

beforeAll(async () => {
  server = createServer((request, response) => {
    void handle(request).then(
      ({ status, headers, body }) => {
        response.writeHead(status, headers);
        response.end(body);
      },
      () => response.writeHead(500).end(),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

let bucketCount = 0;
const options = (overrides: Partial<S3DriverOptions> = {}): S3DriverOptions => ({
  endpoint,
  bucket: `bucket-${++bucketCount}`,
  region: "auto",
  accessKeyId: "AKID",
  secretAccessKey: "secret",
  ...overrides,
});

describeDriver("s3 driver", () => createStorage(createS3Driver(options())));

describe("s3 requests", () => {
  it("signs requests and sends metadata headers", async () => {
    const storage = createStorage(
      createS3Driver(options({ bucket: "meta", sessionToken: "token" })),
    );
    seen.length = 0;
    await storage.put("a b.txt", "x", { contentType: "text/plain", metadata: { Owner: "u1" } });
    const [request] = seen;
    expect(request!.url).toBe("/meta/a%20b.txt");
    expect(request!.headers["x-amz-meta-owner"]).toBe("u1");
    expect(request!.headers["x-amz-security-token"]).toBe("token");
    expect(request!.headers["x-amz-content-sha256"]).toBe("UNSIGNED-PAYLOAD");
    expect(await storage.head("a b.txt")).toMatchObject({ metadata: { owner: "u1" } });
  });

  it("decodes XML keys and maps remote errors", async () => {
    const storage = createStorage(createS3Driver(options()));
    await storage.put("a&b<c>", "x");
    expect((await storage.list()).objects.map((object) => object.key)).toEqual(["a&b<c>"]);
    const denied = createStorage(createS3Driver(options({ accessKeyId: "OTHER" })));
    const error = await denied.list().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StorageError);
    expect(error).toMatchObject({
      code: "REMOTE",
      message: "S3 list failed with 403 AccessDenied",
    });
  });

  it("supports virtual-hosted URLs", async () => {
    const urls: string[] = [];
    const driver = createS3Driver(
      options({
        endpoint: "https://r2.example.com",
        bucket: "media",
        forcePathStyle: false,
        fetch: async (input) => {
          urls.push((input as Request).url);
          return new Response(null, { status: 404 });
        },
      }),
    );
    expect(await driver.head("a/b")).toBeNull();
    expect(urls).toEqual(["https://media.r2.example.com/a/b"]);
  });

  it("presigns uploads bound to type and size", async () => {
    const now = new Date();
    const storage = createStorage(createS3Driver(options({ bucket: "media" })), { now: () => now });
    const signed = await storage.signUpload("u/1.png", {
      contentType: "image/png",
      size: 3,
      expiresIn: 60,
    });
    const url = new URL(signed.url);
    expect(url.pathname).toBe("/media/u/1.png");
    expect(url.searchParams.get("X-Amz-Expires")).toMatch(/^(59|60)$/);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[\da-f]{64}$/);
    expect(signed.headers).toEqual({ "content-type": "image/png" });
    expect(signed.method).toBe("PUT");
  });

  it("presigns downloads with a filename", async () => {
    const storage = createStorage(createS3Driver(options({ bucket: "media" })));
    const signed = await storage.signDownload("u/1.png", { filename: "头像.png" });
    const url = new URL(signed.url);
    expect(url.searchParams.get("response-content-disposition")).toContain("UTF-8''%E5%A4%B4");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(signed.headers).toEqual({});
  });

  it("requires credentials", () => {
    expect(() => createS3Driver(options({ secretAccessKey: "" }))).toThrow(StorageError);
  });
});
