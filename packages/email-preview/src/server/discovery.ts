import { readdir, realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { Template } from "../types.js";
import { PreviewRuntimeError } from "./errors.js";

export function isContained(root: string, path: string): boolean {
  const name = relative(root, path);
  return name === "" || (!isAbsolute(name) && name !== ".." && !name.startsWith(`..${sep}`));
}

export async function resolveDirectory(cwd: string, directory: string): Promise<string> {
  const requested = resolve(cwd, directory);
  try {
    const path = await realpath(requested);
    if (!(await stat(path)).isDirectory()) throw new Error("Not a directory");
    return path;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      // A new project can start the preview before its emails folder exists.
      // Resolve existing ancestors so future path checks use one canonical root.
      const parent = dirname(requested);
      if (parent !== requested)
        return resolve(await resolveDirectory(parent, "."), basename(requested));
    }
    throw new PreviewRuntimeError(
      "DIRECTORY_NOT_FOUND",
      `Email directory not found: ${directory}`,
      400,
    );
  }
}

/** Never use an HTTP-supplied path as a filesystem path without this boundary. */
export async function resolveContainedFile(root: string, name: string): Promise<string> {
  if (!name || name.includes("\\") || name.includes("\0") || isAbsolute(name)) {
    throw new PreviewRuntimeError("NOT_FOUND", "File not found", 404);
  }
  const path = resolve(root, name);
  if (!isContained(root, path)) throw new PreviewRuntimeError("NOT_FOUND", "File not found", 404);
  try {
    const canonical = await realpath(path);
    if (!isContained(root, canonical) || !(await stat(canonical)).isFile()) {
      throw new Error("Outside directory or not a file");
    }
    return canonical;
  } catch {
    throw new PreviewRuntimeError("NOT_FOUND", "File not found", 404);
  }
}

export async function discoverTemplates(root: string): Promise<Template[]> {
  const templates: Template[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.startsWith("_") || entry.name === "static")
        continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
        const id = relative(root, path).split(sep).join("/");
        const slash = id.lastIndexOf("/");
        templates.push({
          id,
          name: entry.name.replace(/\.(tsx|jsx)$/, ""),
          directory: slash < 0 ? "" : id.slice(0, slash),
        });
      }
    }
  }
  try {
    await visit(root);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  return templates.sort((left, right) => left.id.localeCompare(right.id));
}
