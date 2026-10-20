import {
  contentDisposition,
  encodeKey,
  readBody,
  StorageError,
  type SignedRequest,
  type StorageDriver,
} from "./index.js";
import { toBase64Url } from "./internal/encoding.js";

export interface LocalSigningOptions {
  /** HMAC key of at least 32 bytes; keep it on the server. */
  secret: string | Uint8Array;
  /** Absolute URL where `createSignedRequestHandler` is mounted, e.g. `https://api.example.com/files`. */
  baseUrl: string;
  now?: () => Date;
}

interface Claims {
  method: "PUT" | "GET";
  key: string;
  expires: number;
  contentType?: string;
  size?: number;
  filename?: string;
}

const encoder = new TextEncoder();

function canonical(claims: Claims): string {
  return [
    claims.method,
    claims.key,
    claims.expires,
    claims.contentType ?? "",
    claims.size ?? "",
    claims.filename ?? "",
  ].join("\n");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++)
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

/**
 * HMAC-signed URLs for drivers without native presigning (memory, filesystem). The
 * signature binds method, key, expiry and, for uploads, content type and exact size.
 */
export function createLocalSigner({
  secret,
  baseUrl,
  now = () => new Date(),
}: LocalSigningOptions) {
  const secretBytes = typeof secret === "string" ? encoder.encode(secret) : secret;
  if (secretBytes.byteLength < 32)
    throw new StorageError("INVALID_OPTIONS", "Signing secret must be at least 32 bytes");
  const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const keyPromise = crypto.subtle.importKey(
    "raw",
    secretBytes as Uint8Array<ArrayBuffer>,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = async (claims: Claims) =>
    toBase64Url(
      await crypto.subtle.sign("HMAC", await keyPromise, encoder.encode(canonical(claims))),
    );

  async function sign(claims: Claims): Promise<SignedRequest> {
    const url = new URL(encodeKey(claims.key), base);
    url.searchParams.set("x-method", claims.method);
    url.searchParams.set("x-expires", String(claims.expires));
    if (claims.contentType !== undefined) url.searchParams.set("x-type", claims.contentType);
    if (claims.size !== undefined) url.searchParams.set("x-size", String(claims.size));
    if (claims.filename !== undefined) url.searchParams.set("x-filename", claims.filename);
    url.searchParams.set("x-signature", await signature(claims));
    return {
      url: url.href,
      method: claims.method,
      headers: claims.contentType === undefined ? {} : { "content-type": claims.contentType },
      expiresAt: new Date(claims.expires * 1000),
    };
  }

  /** Returns the signed claims, or a reason the request is refused. */
  async function verify(request: Request): Promise<Claims | { status: number; reason: string }> {
    const url = new URL(request.url);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
      return { status: 404, reason: "Not found" };
    let key: string;
    try {
      key = url.pathname.slice(base.pathname.length).split("/").map(decodeURIComponent).join("/");
    } catch {
      return { status: 400, reason: "Invalid key" };
    }
    const param = (name: string) => url.searchParams.get(name) ?? undefined;
    const method = param("x-method");
    const expires = Number(param("x-expires"));
    const contentType = param("x-type");
    const size = param("x-size");
    const filename = param("x-filename");
    if ((method !== "PUT" && method !== "GET") || !Number.isSafeInteger(expires))
      return { status: 403, reason: "Invalid signature" };
    const claims: Claims = {
      method,
      key,
      expires,
      ...(contentType === undefined ? {} : { contentType }),
      ...(size === undefined ? {} : { size: Number(size) }),
      ...(filename === undefined ? {} : { filename }),
    };
    if (!timingSafeEqual(param("x-signature") ?? "", await signature(claims)))
      return { status: 403, reason: "Invalid signature" };
    if (expires * 1000 <= now().getTime()) return { status: 403, reason: "Signature expired" };
    if (request.method !== method) return { status: 405, reason: "Method not allowed" };
    return claims;
  }

  return {
    signUpload: (key: string, options: { contentType: string; size: number; expiresAt: Date }) =>
      sign({
        method: "PUT",
        key,
        expires: Math.floor(options.expiresAt.getTime() / 1000),
        contentType: options.contentType,
        size: options.size,
      }),
    signDownload: (key: string, options: { expiresAt: Date; filename?: string }) =>
      sign({
        method: "GET",
        key,
        expires: Math.floor(options.expiresAt.getTime() / 1000),
        ...(options.filename === undefined ? {} : { filename: options.filename }),
      }),
    verify,
  };
}

export type LocalSigner = ReturnType<typeof createLocalSigner>;

/**
 * Serves signed uploads and downloads for memory and filesystem drivers. Mount it
 * at the signer's `baseUrl`; it never accepts unsigned requests.
 */
export function createSignedRequestHandler(driver: StorageDriver, signer: LocalSigner) {
  return async (request: Request): Promise<Response> => {
    const claims = await signer.verify(request);
    if ("status" in claims) return new Response(claims.reason, { status: claims.status });
    if (claims.method === "PUT") {
      const type = request.headers.get("content-type");
      if (type !== claims.contentType)
        return new Response("Content type mismatch", { status: 403 });
      const declared = request.headers.get("content-length");
      if (declared !== null && Number(declared) > claims.size!)
        return new Response("Size mismatch", { status: 413 });
      let bytes: Uint8Array;
      try {
        bytes = await readBody(request.body ?? new Uint8Array(), claims.size);
      } catch {
        return new Response("Size mismatch", { status: 413 });
      }
      if (bytes.byteLength !== claims.size) return new Response("Size mismatch", { status: 403 });
      const info = await driver.put(claims.key, bytes, { contentType: type });
      return new Response(null, { status: 200, headers: info.etag ? { etag: info.etag } : {} });
    }
    const object = await driver.get(claims.key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers({ "content-length": String(object.info.size) });
    if (object.info.contentType) headers.set("content-type", object.info.contentType);
    if (object.info.etag) headers.set("etag", object.info.etag);
    if (claims.filename !== undefined)
      headers.set("content-disposition", contentDisposition(claims.filename));
    return new Response(object.body, { status: 200, headers });
  };
}
