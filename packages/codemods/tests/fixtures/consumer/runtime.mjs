import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCodemod } from "@raypx-kit/codemods";

const cwd = await mkdtemp(join(tmpdir(), "codemods-consumer-"));
try {
  const path = join(cwd, "source.ts");
  const source = 'import { before } from "fixture";\n';
  await writeFile(path, source);
  const codemod = {
    name: "rename",
    description: "Consumer-owned migration",
    async transform(file) {
      assert.equal(file.path, path);
      return file.source.replace("before", "after");
    },
  };
  assert.deepEqual(await runCodemod(codemod, ["source.ts"], { cwd }), {
    mode: "dry-run",
    files: [{ path, status: "changed" }],
  });
  assert.equal(await readFile(path, "utf8"), source);
  assert.deepEqual(await runCodemod(codemod, [path, "./source.ts"], { cwd, write: true }), {
    mode: "write",
    files: [{ path, status: "changed" }],
  });
  assert.equal(await readFile(path, "utf8"), source.replace("before", "after"));
  assert.deepEqual(await runCodemod(codemod, [path]), {
    mode: "dry-run",
    files: [{ path, status: "unchanged" }],
  });

  // Resolve the actual installed bin relative to its published root entry.
  const cli = join(dirname(fileURLToPath(import.meta.resolve("@raypx-kit/codemods"))), "cli.mjs");
  for (const args of [["list"], ["--help"]]) {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, args[0] === "list" ? /No codemods are registered/ : /Usage:/);
  }
  const unknown = spawnSync(process.execPath, [cli, "missing", path, "--write"], {
    cwd,
    encoding: "utf8",
  });
  assert.ifError(unknown.error);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown migration/);
  assert.equal(await readFile(path, "utf8"), source.replace("before", "after"));
  assert.ok((await readFile(cli, "utf8")).startsWith("#!/usr/bin/env node"));
} finally {
  await rm(cwd, { recursive: true, force: true });
}
