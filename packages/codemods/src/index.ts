import { lstat, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/** A UTF-8 source file. The path is absolute and resolved against the runner's cwd. */
export interface CodemodFile {
  path: string;
  source: string;
}

export interface Codemod {
  name: string;
  description: string;
  /** Return the updated source, or null/undefined to skip the file. */
  transform(file: CodemodFile): string | null | undefined | Promise<string | null | undefined>;
}

export interface RunCodemodOptions {
  cwd?: string;
  /** Defaults to false. All transforms finish before the first file is written. */
  write?: boolean;
}

export interface CodemodResult {
  mode: "dry-run" | "write";
  files: Array<{ path: string; status: "changed" | "unchanged" }>;
}

/** Run one migration against explicit files, preserving their first occurrence order. */
export async function runCodemod(
  codemod: Codemod,
  files: readonly string[],
  options: RunCodemodOptions = {},
): Promise<CodemodResult> {
  const cwd = options.cwd ?? process.cwd();
  const paths = [...new Set(files.map((file) => resolve(cwd, file)))];
  const prepared: Array<{ path: string; source: string; status: "changed" | "unchanged" }> = [];

  for (const path of paths) {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Expected a regular file, not a directory or symlink: ${path}`);
    }
    const source = await readFile(path, "utf8");
    const transformed = await codemod.transform({ path, source });
    if (transformed != null && typeof transformed !== "string") {
      throw new TypeError(`Codemod ${codemod.name} returned a non-string result for ${path}`);
    }
    const output = transformed ?? source;
    prepared.push({ path, source: output, status: output === source ? "unchanged" : "changed" });
  }

  if (options.write) {
    for (const file of prepared) {
      if (file.status === "changed") await writeFile(file.path, file.source, "utf8");
    }
  }

  return {
    mode: options.write ? "write" : "dry-run",
    files: prepared.map(({ path, status }) => ({ path, status })),
  };
}
