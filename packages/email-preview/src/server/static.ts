import { readFile, realpath } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { isContained, resolveContainedFile } from "./discovery.js";
import { PreviewRuntimeError } from "./errors.js";

const contentTypes: Readonly<Record<string, string>> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export async function readStaticFile(
  directory: string,
  name: string,
): Promise<{ data: Uint8Array<ArrayBuffer>; contentType: string }> {
  let root: string;
  try {
    root = await realpath(resolve(directory, "static"));
  } catch {
    throw new PreviewRuntimeError("NOT_FOUND", "Static file not found", 404);
  }
  if (!isContained(directory, root)) {
    throw new PreviewRuntimeError("NOT_FOUND", "Static file not found", 404);
  }
  const path = await resolveContainedFile(root, name);
  return {
    data: await readFile(path),
    contentType: contentTypes[extname(path).toLowerCase()] ?? "application/octet-stream",
  };
}
