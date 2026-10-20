export type StorageErrorCode =
  | "INVALID_KEY"
  | "INVALID_OPTIONS"
  | "TOO_LARGE"
  | "CONTENT_TYPE"
  | "SIGNING_UNAVAILABLE"
  | "REMOTE";

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageError";
    this.code = code;
  }
}

export type StorageBody = Uint8Array | ArrayBuffer | Blob | string | ReadableStream<Uint8Array>;

export interface ObjectInfo {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
  metadata: Record<string, string>;
}

export interface StoredObject {
  info: ObjectInfo;
  body: ReadableStream<Uint8Array>;
}

export interface PutOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface ListOptions {
  prefix?: string;
  cursor?: string;
  /** Page size, 1–1000. */
  limit?: number;
}

export interface ListResult {
  objects: ObjectInfo[];
  /** Pass to the next `list` call; absent on the last page. */
  cursor?: string;
}

/** A request the client sends directly to storage, without the application in between. */
export interface SignedRequest {
  url: string;
  method: "PUT" | "GET";
  /** Headers the client must send exactly as given. */
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface SignUploadOptions {
  contentType: string;
  /** Exact byte length; the signature binds it, so larger uploads are rejected. */
  size: number;
  /** Seconds until the URL expires. */
  expiresIn?: number;
}

export interface SignDownloadOptions {
  expiresIn?: number;
  /** Suggested download name, sent as Content-Disposition. */
  filename?: string;
}

/** What each backend implements. Applications use `createStorage`, which validates first. */
export interface StorageDriver {
  put(key: string, body: StorageBody, options: PutOptions): Promise<ObjectInfo>;
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<ObjectInfo | null>;
  delete(key: string): Promise<void>;
  list(options: Required<Pick<ListOptions, "limit">> & ListOptions): Promise<ListResult>;
  signUpload(
    key: string,
    options: { contentType: string; size: number; expiresAt: Date },
  ): Promise<SignedRequest>;
  signDownload(
    key: string,
    options: { expiresAt: Date; filename?: string },
  ): Promise<SignedRequest>;
}

export interface StoragePolicy {
  /** Largest accepted object in bytes. */
  maxSize?: number;
  /** Accepted content types; `image/*` matches a whole family. */
  contentTypes?: readonly string[];
  /** Default and longest signed URL lifetime in seconds (default 900 and 3600). */
  defaultExpiresIn?: number;
  maxExpiresIn?: number;
  now?: () => Date;
}

export type Storage = Omit<StorageDriver, "put" | "list" | "signUpload" | "signDownload"> & {
  put(key: string, body: StorageBody, options?: PutOptions): Promise<ObjectInfo>;
  list(options?: ListOptions): Promise<ListResult>;
  signUpload(key: string, options: SignUploadOptions): Promise<SignedRequest>;
  signDownload(key: string, options?: SignDownloadOptions): Promise<SignedRequest>;
};

const MAX_KEY_BYTES = 1024;
const encoder = new TextEncoder();

/**
 * Keys are relative slash-separated paths: no leading slash, empty, `.` or `..`
 * segments, backslashes or control characters, at most 1024 UTF-8 bytes.
 */
export function assertKey(key: string): void {
  const valid =
    typeof key === "string" &&
    key.length > 0 &&
    encoder.encode(key).length <= MAX_KEY_BYTES &&
    !key.includes("\\") &&
    // oxlint-disable-next-line no-control-regex -- Control characters are rejected in keys.
    !/[\u0000-\u001f\u007f]/.test(key) &&
    key.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
  if (!valid) throw new StorageError("INVALID_KEY", "Invalid storage key");
}

/** Validates a `prefix` for listing; a trailing slash is allowed. */
function assertPrefix(prefix: string): void {
  if (prefix === "") return;
  assertKey(prefix.endsWith("/") ? prefix.slice(0, -1) : prefix);
}

function matchesType(contentType: string, accepted: readonly string[]): boolean {
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  return accepted.some((pattern) => {
    const wanted = pattern.toLowerCase();
    return wanted.endsWith("/*") ? type.startsWith(wanted.slice(0, -1)) : type === wanted;
  });
}

export function knownSize(body: StorageBody): number | undefined {
  if (typeof body === "string") return encoder.encode(body).length;
  if (body instanceof Uint8Array || body instanceof ArrayBuffer) return body.byteLength;
  if (body instanceof Blob) return body.size;
  return undefined;
}

/**
 * Wraps a driver with key, size, content-type and expiry checks. Streamed bodies of
 * unknown length are checked by drivers that read them; signed uploads bind the size.
 */
export function createStorage(driver: StorageDriver, policy: StoragePolicy = {}): Storage {
  const now = policy.now ?? (() => new Date());
  const defaultExpiresIn = policy.defaultExpiresIn ?? 900;
  const maxExpiresIn = policy.maxExpiresIn ?? 3600;
  const checkType = (contentType: string | undefined) => {
    if (!policy.contentTypes) return;
    if (!contentType || !matchesType(contentType, policy.contentTypes))
      throw new StorageError("CONTENT_TYPE", "Content type is not accepted");
  };
  const checkSize = (size: number | undefined) => {
    if (size === undefined) return;
    if (!Number.isSafeInteger(size) || size < 0)
      throw new StorageError("INVALID_OPTIONS", "Size must be a non-negative integer");
    if (policy.maxSize !== undefined && size > policy.maxSize)
      throw new StorageError("TOO_LARGE", "Object exceeds the size limit");
  };
  const expiresAt = (expiresIn = defaultExpiresIn) => {
    if (!Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > maxExpiresIn)
      throw new StorageError("INVALID_OPTIONS", `Expiry must be 1–${maxExpiresIn} seconds`);
    return new Date(now().getTime() + Math.floor(expiresIn) * 1000);
  };
  return {
    async put(key, body, options = {}) {
      assertKey(key);
      checkType(options.contentType);
      const size = knownSize(body);
      checkSize(size);
      const limited =
        size === undefined && policy.maxSize !== undefined && body instanceof ReadableStream
          ? limitStream(body, policy.maxSize)
          : body;
      return driver.put(key, limited, options);
    },
    async get(key) {
      assertKey(key);
      return driver.get(key);
    },
    async head(key) {
      assertKey(key);
      return driver.head(key);
    },
    async delete(key) {
      assertKey(key);
      return driver.delete(key);
    },
    async list({ prefix = "", cursor, limit = 100 } = {}) {
      assertPrefix(prefix);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
        throw new StorageError("INVALID_OPTIONS", "List limit must be 1–1000");
      return driver.list({ prefix, limit, ...(cursor === undefined ? {} : { cursor }) });
    },
    async signUpload(key, options) {
      assertKey(key);
      checkType(options.contentType);
      if (!options.contentType)
        throw new StorageError("INVALID_OPTIONS", "Signed uploads require a content type");
      checkSize(options.size);
      return driver.signUpload(key, {
        contentType: options.contentType,
        size: options.size,
        expiresAt: expiresAt(options.expiresIn),
      });
    },
    async signDownload(key, options = {}) {
      assertKey(key);
      return driver.signDownload(key, {
        expiresAt: expiresAt(options.expiresIn),
        ...(options.filename === undefined ? {} : { filename: options.filename }),
      });
    },
  };
}

const rfc3986 = (segment: string) =>
  encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** Encodes each key segment for a URL path (RFC 3986, as S3 signing expects). */
export function encodeKey(key: string): string {
  return key.split("/").map(rfc3986).join("/");
}

/** RFC 6266 Content-Disposition with an ASCII fallback and a UTF-8 name. */
export function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Collects any body into bytes; drivers that need the whole object use this. */
export async function readBody(body: StorageBody, limit?: number): Promise<Uint8Array> {
  if (typeof body === "string") return encoder.encode(body);
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (limit !== undefined && size > limit) {
      await reader.cancel();
      throw new StorageError("TOO_LARGE", "Object exceeds the size limit");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Errors the stream with TOO_LARGE once it yields more than `max` bytes. */
export function limitStream(
  stream: ReadableStream<Uint8Array>,
  max: number,
): ReadableStream<Uint8Array> {
  let size = 0;
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        size += chunk.byteLength;
        if (size > max)
          controller.error(new StorageError("TOO_LARGE", "Object exceeds the size limit"));
        else controller.enqueue(chunk);
      },
    }),
  );
}
