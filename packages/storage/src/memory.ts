import {
  readBody,
  StorageError,
  streamOf,
  type ListResult,
  type ObjectInfo,
  type StorageDriver,
} from "./index.js";
import { toHex } from "./internal/encoding.js";
import type { LocalSigner } from "./signed.js";

export interface MemoryDriverOptions {
  /** Enables signed URLs served by `createSignedRequestHandler`. */
  signer?: LocalSigner;
}

interface Entry {
  info: ObjectInfo;
  bytes: Uint8Array;
}

async function etagOf(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return `"${toHex(digest).slice(0, 32)}"`;
}

const clone = (info: ObjectInfo): ObjectInfo => ({ ...info, metadata: { ...info.metadata } });

/** Shared listing over sorted keys; the cursor is the last key returned. */
export function page(
  keys: readonly string[],
  info: (key: string) => ObjectInfo,
  { prefix = "", cursor, limit }: { prefix?: string; cursor?: string; limit: number },
): ListResult {
  const matching = keys
    .filter((key) => key.startsWith(prefix) && (cursor === undefined || key > cursor))
    .sort();
  const selected = matching.slice(0, limit);
  return {
    objects: selected.map(info),
    ...(matching.length > limit ? { cursor: selected.at(-1)! } : {}),
  };
}

export function unsigned(): never {
  throw new StorageError("SIGNING_UNAVAILABLE", "This driver has no URL signer");
}

/** Process-local storage for tests and development. */
export function createMemoryDriver({ signer }: MemoryDriverOptions = {}): StorageDriver {
  const entries = new Map<string, Entry>();
  return {
    async put(key, body, options) {
      const bytes = (await readBody(body)).slice();
      const info: ObjectInfo = {
        key,
        size: bytes.byteLength,
        ...(options.contentType === undefined ? {} : { contentType: options.contentType }),
        etag: await etagOf(bytes),
        lastModified: new Date(),
        metadata: { ...options.metadata },
      };
      entries.set(key, { info, bytes });
      return clone(info);
    },
    async get(key) {
      const entry = entries.get(key);
      return entry ? { info: clone(entry.info), body: streamOf(entry.bytes.slice()) } : null;
    },
    async head(key) {
      const entry = entries.get(key);
      return entry ? clone(entry.info) : null;
    },
    async delete(key) {
      entries.delete(key);
    },
    async list(options) {
      return page([...entries.keys()], (key) => clone(entries.get(key)!.info), options);
    },
    async signUpload(key, options) {
      return signer ? signer.signUpload(key, options) : unsigned();
    },
    async signDownload(key, options) {
      return signer ? signer.signDownload(key, options) : unsigned();
    },
  };
}
