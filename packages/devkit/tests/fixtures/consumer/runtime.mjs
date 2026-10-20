import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkArchitecture } from "@raypx-kit/devkit/architecture";
import { discover } from "@raypx-kit/devkit/workspaces";

const root = mkdtempSync(join(tmpdir(), "devkit-consumer-"));
try {
  const directory = join(root, "packages/library");
  const marker = join(root, "config-executed");
  mkdirSync(join(directory, "src"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ private: true, workspaces: ["packages/*"] }),
  );
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({
      name: "@fixture/library",
      type: "module",
      exports: { ".": "./dist/index.mjs" },
      devkit: { kind: "library", target: "browser" },
    }),
  );
  writeFileSync(
    join(directory, "src/index.ts"),
    'import { basename } from "node:path"; export const name = basename("library");',
  );
  writeFileSync(
    join(root, "devkit.config.ts"),
    `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "executed"); throw new Error("Configuration must not execute");`,
  );

  const metadata = {
    "packages/library": {
      kind: "library",
      target: "node",
      sourceEntries: { ".": "./src/index.ts" },
    },
  };
  const index = discover(root, { metadata });
  assert.equal(existsSync(join(directory, "dist")), false);
  assert.deepEqual(index.findings, []);
  assert.deepEqual(index.workspaces[0]?.metadata, metadata["packages/library"]);
  assert.deepEqual(checkArchitecture(index), []);

  // Supplying metadata replaces manifest policy completely, including omitted entries.
  const missing = discover(root, { metadata: {} });
  assert.equal(missing.workspaces[0]?.metadata, undefined);
  assert.ok(missing.findings.some((finding) => finding.includes("packages/library")));
  assert.ok(checkArchitecture(missing).length > 0);

  const unknown = discover(root, {
    metadata: { ...metadata, "packages/missing": metadata["packages/library"] },
  });
  assert.ok(unknown.findings.some((finding) => finding.includes("packages/missing")));
  assert.ok(checkArchitecture(unknown).length > 0);
  assert.equal(existsSync(marker), false);
} finally {
  rmSync(root, { recursive: true, force: true });
}
