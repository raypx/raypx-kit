import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import { page, unsigned } from "./memory.js";
import { StorageError, type ObjectInfo, type StorageBody, type StorageDriver } from "./index.js";
import type { LocalSigner } from "./signed.js";

export interface FileSystemDriverOptions {
  /** Directory that owns `objects/` and `meta/`; created on first write. */
  root: string;
  signer?: LocalSigner;
}

interface Meta {
  contentType?: string;
  etag: string;
  metadata: Record<string, string>;
}

/** A key under an existing object, or an object where a prefix exists. */
const PREFIX_CONFLICTS = new Set(["EEXIST", "ENOTDIR", "EISDIR", "ENOTEMPTY"]);

function toReadable(body: StorageBody): Readable {
  if (typeof body === "string" || body instanceof Uint8Array)
    return Readable.from([typeof body === "string" ? Buffer.from(body) : body]);
  if (body instanceof ArrayBuffer) return Readable.from([new Uint8Array(body)]);
  const stream = body instanceof Blob ? body.stream() : body;
  return Readable.fromWeb(stream as NodeReadableStream<Uint8Array>);
}

async function writeAtomically(file: string, write: (temporary: string) => Promise<void>) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await write(temporary);
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function walk(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true, recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && !entry.name.endsWith(".tmp"))
    .map((entry) => join(entry.parentPath, entry.name));
}

/**
 * Stores objects under `root/objects/<key>` with metadata in `root/meta/<key>.json`.
 * Writes go through a temporary file and rename, so readers never see partial objects.
 */
export function createFileSystemDriver({ root, signer }: FileSystemDriverOptions): StorageDriver {
  const objects = join(root, "objects");
  const meta = join(root, "meta");
  const objectPath = (key: string) => join(objects, ...key.split("/"));
  const metaPath = (key: string) => `${join(meta, ...key.split("/"))}.json`;

  async function head(key: string): Promise<ObjectInfo | null> {
    let size: number;
    let lastModified: Date;
    try {
      const stats = await stat(objectPath(key));
      if (!stats.isFile()) return null;
      ({ size, mtime: lastModified } = stats);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    let stored: Partial<Meta> = {};
    try {
      stored = JSON.parse(await readFile(metaPath(key), "utf8")) as Meta;
    } catch {
      // Objects copied in without metadata remain readable.
    }
    return {
      key,
      size,
      ...(stored.contentType === undefined ? {} : { contentType: stored.contentType }),
      ...(stored.etag === undefined ? {} : { etag: stored.etag }),
      lastModified,
      metadata: { ...stored.metadata },
    };
  }

  return {
    async put(key, body, options) {
      const file = objectPath(key);
      const hash = createHash("sha256");
      try {
        await writeAtomically(file, (temporary) =>
          pipeline(
            toReadable(body),
            new Transform({
              transform(chunk: Buffer, _encoding, callback) {
                hash.update(chunk);
                callback(null, chunk);
              },
            }),
            createWriteStream(temporary, { flags: "wx", mode: 0o600 }),
          ),
        );
      } catch (error) {
        if (error instanceof StorageError) throw error;
        if (PREFIX_CONFLICTS.has((error as NodeJS.ErrnoException).code ?? ""))
          throw new StorageError("INVALID_KEY", "Key conflicts with an existing object or prefix", {
            cause: error,
          });
        throw error;
      }
      const stored: Meta = {
        ...(options.contentType === undefined ? {} : { contentType: options.contentType }),
        etag: `"${hash.digest("hex").slice(0, 32)}"`,
        metadata: { ...options.metadata },
      };
      await writeAtomically(metaPath(key), (temporary) =>
        writeFile(temporary, JSON.stringify(stored), { flag: "wx", mode: 0o600 }),
      );
      return (await head(key))!;
    },
    async get(key) {
      const info = await head(key);
      if (!info) return null;
      const body = Readable.toWeb(createReadStream(objectPath(key))) as ReadableStream<Uint8Array>;
      return { info, body };
    },
    head,
    async delete(key) {
      await rm(objectPath(key), { force: true });
      await rm(metaPath(key), { force: true });
    },
    async list(options) {
      const keys = (await walk(objects)).map((file) =>
        relative(objects, file).split(sep).join("/"),
      );
      const infos = new Map<string, ObjectInfo>();
      const result = page(keys, (key) => ({ key, size: 0, metadata: {} }), options);
      for (const object of result.objects) {
        const info = await head(object.key);
        if (info) infos.set(object.key, info);
      }
      return {
        objects: result.objects.flatMap((object) => infos.get(object.key) ?? []),
        ...(result.cursor === undefined ? {} : { cursor: result.cursor }),
      };
    },
    async signUpload(key, options) {
      return signer ? signer.signUpload(key, options) : unsigned();
    },
    async signDownload(key, options) {
      return signer ? signer.signDownload(key, options) : unsigned();
    },
  };
}
