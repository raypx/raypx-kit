import { AwsClient } from "aws4fetch";

import {
  contentDisposition,
  encodeKey,
  readBody,
  StorageError,
  type ObjectInfo,
  type SignedRequest,
  type StorageDriver,
} from "./index.js";

export interface S3DriverOptions {
  /** Service origin, e.g. `https://s3.us-east-1.amazonaws.com` or an R2/MinIO endpoint. */
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  /** `endpoint/bucket/key` (default) instead of `bucket.endpoint/key`. */
  forcePathStyle?: boolean;
  fetch?: typeof globalThis.fetch;
}

const META_PREFIX = "x-amz-meta-";

function decodeXml(value: string): string {
  return value.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[\da-f]+);/gi, (entity, name: string) => {
    const named: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
    if (name in named) return named[name]!;
    const code =
      name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return Number.isNaN(code) ? entity : String.fromCodePoint(code);
  });
}

function tag(xml: string, name: string): string | undefined {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  return match ? decodeXml(match[1]!) : undefined;
}

async function remoteError(response: Response, action: string): Promise<StorageError> {
  const code = tag(await response.text().catch(() => ""), "Code");
  return new StorageError(
    "REMOTE",
    `S3 ${action} failed with ${response.status}${code ? ` ${code}` : ""}`,
  );
}

function infoFrom(key: string, headers: Headers): ObjectInfo {
  const metadata: Record<string, string> = {};
  headers.forEach((value, name) => {
    if (name.startsWith(META_PREFIX)) metadata[name.slice(META_PREFIX.length)] = value;
  });
  const type = headers.get("content-type");
  const etag = headers.get("etag");
  const modified = headers.get("last-modified");
  return {
    key,
    size: Number(headers.get("content-length") ?? 0),
    ...(type === null ? {} : { contentType: type }),
    ...(etag === null ? {} : { etag }),
    ...(modified === null ? {} : { lastModified: new Date(modified) }),
    metadata,
  };
}

/** S3-compatible storage (AWS S3, Cloudflare R2, MinIO) signed with SigV4. */
export function createS3Driver({
  endpoint,
  bucket,
  region,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  forcePathStyle = true,
  fetch = globalThis.fetch,
}: S3DriverOptions): StorageDriver {
  const origin = new URL(endpoint);
  if (!bucket || !region || !accessKeyId || !secretAccessKey)
    throw new StorageError("INVALID_OPTIONS", "S3 bucket, region and credentials are required");
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    ...(sessionToken === undefined ? {} : { sessionToken }),
    service: "s3",
    region,
  });
  const base = forcePathStyle
    ? new URL(`${origin.pathname.replace(/\/$/, "")}/${encodeKey(bucket)}/`, origin)
    : new URL(`${origin.protocol}//${bucket}.${origin.host}${origin.pathname.replace(/\/$/, "")}/`);
  const objectUrl = (key: string) => new URL(encodeKey(key), base);

  async function send(url: URL, init: RequestInit): Promise<Response> {
    const request = await client.sign(url.href, init);
    return fetch(request);
  }

  async function presign(
    method: "PUT" | "GET",
    url: URL,
    expiresAt: Date,
    headers: Record<string, string>,
  ): Promise<SignedRequest> {
    const seconds = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
    url.searchParams.set("X-Amz-Expires", String(seconds));
    const signed = await client.sign(url.href, {
      method,
      headers,
      aws: { signQuery: true, allHeaders: true },
    });
    const { "content-length": _length, ...sent } = headers;
    return { url: signed.url, method, headers: sent, expiresAt };
  }

  return {
    async put(key, body, options) {
      const bytes = await readBody(body);
      const headers: Record<string, string> = {};
      if (options.contentType !== undefined) headers["content-type"] = options.contentType;
      for (const [name, value] of Object.entries(options.metadata ?? {}))
        headers[`${META_PREFIX}${name.toLowerCase()}`] = value;
      const response = await send(objectUrl(key), {
        method: "PUT",
        headers,
        body: bytes as Uint8Array<ArrayBuffer>,
      });
      if (!response.ok) throw await remoteError(response, "put");
      await response.body?.cancel();
      const etag = response.headers.get("etag");
      return {
        key,
        size: bytes.byteLength,
        ...(options.contentType === undefined ? {} : { contentType: options.contentType }),
        ...(etag === null ? {} : { etag }),
        lastModified: new Date(),
        metadata: { ...options.metadata },
      };
    },
    async get(key) {
      const response = await send(objectUrl(key), { method: "GET" });
      if (response.status === 404) {
        await response.body?.cancel();
        return null;
      }
      if (!response.ok || !response.body) throw await remoteError(response, "get");
      return { info: infoFrom(key, response.headers), body: response.body };
    },
    async head(key) {
      const response = await send(objectUrl(key), { method: "HEAD" });
      if (response.status === 404) return null;
      if (!response.ok) throw await remoteError(response, "head");
      return infoFrom(key, response.headers);
    },
    async delete(key) {
      const response = await send(objectUrl(key), { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw await remoteError(response, "delete");
      await response.body?.cancel();
    },
    async list({ prefix = "", cursor, limit }) {
      const url = new URL(base);
      url.searchParams.set("list-type", "2");
      url.searchParams.set("max-keys", String(limit));
      if (prefix) url.searchParams.set("prefix", prefix);
      if (cursor !== undefined) url.searchParams.set("continuation-token", cursor);
      const response = await send(url, { method: "GET" });
      if (!response.ok) throw await remoteError(response, "list");
      const xml = await response.text();
      const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, entry]) => {
        const etag = tag(entry!, "ETag");
        const modified = tag(entry!, "LastModified");
        return {
          key: tag(entry!, "Key")!,
          size: Number(tag(entry!, "Size") ?? 0),
          ...(etag === undefined ? {} : { etag }),
          ...(modified === undefined ? {} : { lastModified: new Date(modified) }),
          metadata: {},
        };
      });
      const next =
        tag(xml, "IsTruncated") === "true" ? tag(xml, "NextContinuationToken") : undefined;
      return { objects, ...(next === undefined ? {} : { cursor: next }) };
    },
    async signUpload(key, { contentType, size, expiresAt }) {
      return presign("PUT", objectUrl(key), expiresAt, {
        "content-type": contentType,
        "content-length": String(size),
      });
    },
    async signDownload(key, { expiresAt, filename }) {
      const url = objectUrl(key);
      if (filename !== undefined)
        url.searchParams.set("response-content-disposition", contentDisposition(filename));
      return presign("GET", url, expiresAt, {});
    },
  };
}
