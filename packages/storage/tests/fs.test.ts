import { mkdtemp, readdir, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { describeDriver } from "./helpers/conformance.js";
import { createFileSystemDriver } from "../src/fs.js";
import { createStorage, StorageError } from "../src/index.js";

const roots: string[] = [];
async function root() {
  const directory = await mkdtemp(join(tmpdir(), "raypx-kit-storage-"));
  roots.push(directory);
  return directory;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describeDriver("filesystem driver", async () =>
  createStorage(createFileSystemDriver({ root: await root() })),
);

describe("filesystem layout", () => {
  it("keeps objects inside root and leaves no temporary files", async () => {
    const directory = await root();
    const storage = createStorage(createFileSystemDriver({ root: directory }));
    await storage.put("a/b.txt", "x", { contentType: "text/plain" });
    expect(await readdir(join(directory, "objects", "a"))).toEqual(["b.txt"]);
    expect(await readdir(join(directory, "meta", "a"))).toEqual(["b.txt.json"]);
    if (process.platform !== "win32")
      expect((await stat(join(directory, "objects", "a", "b.txt"))).mode & 0o777).toBe(0o600);
  });

  it("keeps the previous object when a stream fails", async () => {
    const directory = await root();
    const storage = createStorage(createFileSystemDriver({ root: directory }), { maxSize: 3 });
    await storage.put("a", "old");
    const failing = new Blob(["toolong"]).stream();
    await expect(storage.put("a", failing)).rejects.toThrow("size limit");
    expect(await new Response((await storage.get("a"))!.body).text()).toBe("old");
    expect(await readdir(join(directory, "objects"))).toEqual(["a"]);
  });

  it("rejects keys that collide with a prefix", async () => {
    const storage = createStorage(createFileSystemDriver({ root: await root() }));
    await storage.put("a", "x");
    await expect(storage.put("a/b", "y")).rejects.toBeInstanceOf(StorageError);
    await storage.put("c/d", "x");
    await expect(storage.put("c", "y")).rejects.toBeInstanceOf(StorageError);
    expect(await storage.head("a")).toMatchObject({ size: 1 });
  });

  it("reads objects without metadata", async () => {
    const directory = await root();
    await mkdir(join(directory, "objects"), { recursive: true });
    await writeFile(join(directory, "objects", "plain"), "abc");
    const storage = createStorage(createFileSystemDriver({ root: directory }));
    expect(await storage.head("plain")).toMatchObject({ size: 3, metadata: {} });
    expect((await storage.list()).objects.map((object) => object.key)).toEqual(["plain"]);
  });
});
