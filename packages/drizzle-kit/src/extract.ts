import { createRequire } from "node:module";
import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Upstream files the CLI and `defineConfig` need; every other prebuilt entry is omitted. */
const ENTRIES = ["bin.cjs", "index.js", "index.mjs", "index.d.ts", "index.d.mts"];
/** Read at runtime by the CLI's `skills` and `mcp` commands, next to `bin.cjs`. */
const DIRECTORIES = ["skills"];
const RELATIVE_IMPORT = /\bfrom\s+["'](\.\/[^"']+)["']|\brequire\(["'](\.\/[^"']+)["']\)/g;

export interface UpstreamManifest {
  name: string;
  version: string;
  license: string;
  bin: Record<string, string>;
  dependencies: Record<string, string>;
}

export function upstreamDirectory(from: string): string {
  const require = createRequire(join(from, "package.json"));
  return dirname(require.resolve("drizzle-kit"));
}

export async function readUpstream(directory: string): Promise<UpstreamManifest> {
  return JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as UpstreamManifest;
}

/** Entries plus every chunk they reference, in a stable order. */
export async function collectFiles(directory: string): Promise<string[]> {
  const files = new Set<string>();
  const pending = [...ENTRIES];
  while (pending.length > 0) {
    const file = pending.shift()!;
    if (files.has(file)) continue;
    files.add(file);
    if (file === "bin.cjs") continue; // Self-contained bundle.
    const source = await readFile(join(directory, file), "utf8");
    for (const match of source.matchAll(RELATIVE_IMPORT)) {
      const specifier = (match[1] ?? match[2])!.slice(2);
      const declaration = file.endsWith(".d.mts")
        ? specifier.replace(/\.mjs$/, ".d.mts")
        : file.endsWith(".d.ts")
          ? specifier.replace(/\.js$/, ".d.ts")
          : specifier;
      pending.push(declaration);
    }
  }
  return [...files].sort();
}

export async function extract(from: string, output: string): Promise<string[]> {
  const directory = upstreamDirectory(from);
  const files = await collectFiles(directory);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const file of files) await copyFile(join(directory, file), join(output, file));
  for (const name of DIRECTORIES)
    await cp(join(directory, name), join(output, name), { recursive: true });
  // Preserve upstream's CommonJS .js/.d.ts semantics inside this ESM package.
  await writeFile(join(output, "package.json"), `${JSON.stringify({ type: "commonjs" })}\n`);
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const files = await extract(root, join(root, "dist"));
  console.log(`Extracted ${files.length} drizzle-kit files into dist/`);
}
