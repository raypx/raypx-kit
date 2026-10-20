import {
  runCodemod,
  type Codemod,
  type CodemodFile,
  type CodemodResult,
  type RunCodemodOptions,
} from "@raypx-kit/codemods";

const options: RunCodemodOptions = { cwd: "/fixture", write: false };
const migration: Codemod = {
  name: "rename",
  description: "A consumer-defined migration",
  async transform(file: CodemodFile) {
    const path: string = file.path;
    return path.endsWith(".ts") ? file.source.replace("before", "after") : null;
  },
};
const files: readonly string[] = [];
const result: CodemodResult = await runCodemod(migration, files, options);
const mode: "dry-run" | "write" = result.mode;
const status: "changed" | "unchanged" | undefined = result.files[0]?.status;
void mode;
void status;

const skipped: Codemod = { ...migration, transform: () => undefined };
void skipped;
// @ts-expect-error Transforms return source text or skip the file, never booleans.
const invalid: Codemod = { ...migration, transform: () => true };
void invalid;
