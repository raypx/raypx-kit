import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vite-plus/test";
import { cacheChanged } from "../../../scripts/ci/cache.js";

it("uploads new successful artifacts, not cache database rewrites", () => {
  const root = mkdtempSync(join(tmpdir(), "kit-ci-cache-"));
  try {
    const cache = join(root, "node_modules/.vite/task-cache/v18");
    mkdirSync(cache, { recursive: true });
    writeFileSync(join(cache, "existing.tar.zst"), "artifact");
    cacheChanged(root, "snapshot");
    writeFileSync(join(cache, "state.db"), "new database metadata");
    expect(cacheChanged(root, "changed")).toBe(false);
    writeFileSync(join(cache, "new.tar.zst"), "new successful artifact");
    expect(cacheChanged(root, "changed")).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
