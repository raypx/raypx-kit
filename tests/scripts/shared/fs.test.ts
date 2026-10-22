import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { withTempDirectory, writeFileAtomic } from "../../../scripts/shared/fs.js";

const roots: string[] = [];
async function root() {
  const directory = await mkdtemp(join(tmpdir(), "scripts-fs-test-"));
  roots.push(directory);
  return directory;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("withTempDirectory", () => {
  it("returns the callback value and removes its nested output after success", async () => {
    let created = "";
    const result = await withTempDirectory("scripts-fs-success-", async (directory) => {
      created = directory;
      expect(existsSync(directory)).toBe(true);
      await mkdir(join(directory, "nested"));
      await writeFile(join(directory, "nested", "result"), "temporary");
      return { count: 2 };
    });
    expect(result).toEqual({ count: 2 });
    expect(existsSync(created)).toBe(false);
  });

  it.each([false, true])("cleans up when the callback fails (async: %s)", async (async) => {
    let created = "";
    const error = new Error("operation failed");
    await expect(
      withTempDirectory("scripts-fs-failure-", (directory) => {
        created = directory;
        if (async) return Promise.reject(error);
        throw error;
      }),
    ).rejects.toBe(error);
    expect(existsSync(created)).toBe(false);
  });

  it.each(["", ".", "..", "../escape", "nested/path", "nested\\path", "null\0byte"])(
    "rejects an invalid prefix before calling the operation: %j",
    async (prefix) => {
      let called = false;
      await expect(
        withTempDirectory(prefix, () => {
          called = true;
        }),
      ).rejects.toThrow(TypeError);
      expect(called).toBe(false);
    },
  );
});

describe("writeFileAtomic", () => {
  it("creates parents and writes UTF-8 text and bytes without temporary leftovers", async () => {
    const directory = join(await root(), "nested");
    await writeFileAtomic(join(directory, "text"), "Hello 世界");
    await writeFileAtomic(join(directory, "bytes"), new Uint8Array([0, 255, 1]));
    expect(await readFile(join(directory, "text"), "utf8")).toBe("Hello 世界");
    expect(new Uint8Array(await readFile(join(directory, "bytes")))).toEqual(
      new Uint8Array([0, 255, 1]),
    );
    expect((await readdir(directory)).sort()).toEqual(["bytes", "text"]);
    if (process.platform !== "win32")
      expect((await stat(join(directory, "text"))).mode & 0o777).toBe(0o600 & ~process.umask());
  });

  it("replaces an existing file and applies explicitly requested permissions", async () => {
    const file = join(await root(), "result");
    await writeFile(file, "old");
    await writeFileAtomic(file, "new", { mode: 0o640 });
    expect(await readFile(file, "utf8")).toBe("new");
    if (process.platform !== "win32")
      expect((await stat(file)).mode & 0o777).toBe(0o640 & ~process.umask());
  });

  it("leaves an existing directory untouched and cleans up when rename fails", async () => {
    const directory = await root();
    const target = join(directory, "result");
    await mkdir(target);
    await writeFile(join(target, "original"), "keep");
    await expect(writeFileAtomic(target, "replacement")).rejects.toThrow();
    expect(await readFile(join(target, "original"), "utf8")).toBe("keep");
    expect(await readdir(directory)).toEqual(["result"]);
  });

  it("preserves the previous file when cancellation is already requested", async () => {
    const directory = await root();
    const target = join(directory, "result");
    await writeFile(target, "old");
    const controller = new AbortController();
    const error = new Error("cancelled");
    controller.abort(error);
    await expect(writeFileAtomic(target, "new", { signal: controller.signal })).rejects.toBe(error);
    expect(await readFile(target, "utf8")).toBe("old");
    expect(await readdir(directory)).toEqual(["result"]);
  });

  it("exposes only complete contents while concurrent writers replace the same file", async () => {
    const directory = await root();
    const target = join(directory, "result");
    await writeFile(target, "initial");
    const contents = Array.from({ length: 8 }, (_, index) => String(index).repeat(128 * 1024));
    const allowed = new Set(["initial", ...contents]);
    await Promise.all([
      Promise.all(contents.map((data) => writeFileAtomic(target, data))),
      (async () => {
        for (let index = 0; index < 20; index++)
          expect(allowed.has(await readFile(target, "utf8"))).toBe(true);
      })(),
    ]);
    expect(contents).toContain(await readFile(target, "utf8"));
    expect(await readdir(directory)).toEqual(["result"]);
  });
});
