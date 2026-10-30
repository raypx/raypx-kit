import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { compatibilityMatrix, type CompatibilityIndex } from "../packages/matrix.js";

/** Validate the immutable compatibility artifact before any registry upload is possible. */
export async function verifiedArchives(directory: string, commit: string) {
  const index = JSON.parse(
    await readFile(join(directory, "index.json"), "utf8"),
  ) as CompatibilityIndex;
  compatibilityMatrix(index);
  assert.equal(index.commit, commit, "Verified archives belong to another commit");
  const archives = new Map<
    string,
    {
      path: string;
      manifest: CompatibilityIndex["packages"][number]["manifest"];
      integrity: string;
    }
  >();
  for (const entry of index.packages) {
    assert.ok(!entry.archive.includes("\\"), "Archive must use a portable basename");
    assert.equal(
      basename(entry.archive),
      entry.archive,
      "Archive must stay in its artifact directory",
    );
    assert.match(entry.sha256, /^[a-f0-9]{64}$/, "Invalid verified archive digest");
    const path = join(directory, entry.archive),
      contents = await readFile(path);
    const digest = createHash("sha256").update(contents);
    assert.equal(
      digest.digest("hex"),
      entry.sha256,
      `${entry.manifest.name}: archive digest changed`,
    );
    const manifest = JSON.parse(
      execFileSync("tar", ["-xOf", path, "package/package.json"], { encoding: "utf8" }),
    );
    assert.equal(manifest.name, entry.manifest.name, "Verified archive package differs");
    assert.equal(manifest.version, entry.manifest.version, "Verified archive version differs");
    assert.deepEqual(manifest.exports, entry.manifest.exports, "Verified archive exports differ");
    assert.ok(!archives.has(manifest.name), "Duplicate verified package");
    archives.set(manifest.name, {
      path,
      manifest,
      integrity: `sha256-${Buffer.from(entry.sha256, "hex").toString("base64")}`,
    });
  }
  return archives;
}
