import { describe, expect, it } from "vite-plus/test";

import type { Storage } from "../../src/index.js";

const text = async (storage: Storage, key: string) => {
  const object = await storage.get(key);
  return object ? new Response(object.body).text() : null;
};

/** Behaviour every driver shares; reused by the filesystem and S3 tests. */
export function describeDriver(name: string, create: () => Promise<Storage> | Storage) {
  // oxlint-disable-next-line vitest/valid-title -- Each driver suite passes its own name.
  describe(name, () => {
    it("writes, reads, heads and deletes", async () => {
      const storage = await create();
      const info = await storage.put("docs/a.txt", "hello", {
        contentType: "text/plain",
        metadata: { owner: "u1" },
      });
      expect(info).toMatchObject({ key: "docs/a.txt", size: 5, contentType: "text/plain" });
      expect(info.etag).toBeTruthy();
      expect(await text(storage, "docs/a.txt")).toBe("hello");
      expect(await storage.head("docs/a.txt")).toMatchObject({
        size: 5,
        contentType: "text/plain",
        metadata: { owner: "u1" },
      });
      await storage.put("docs/a.txt", "bye");
      expect(await text(storage, "docs/a.txt")).toBe("bye");
      await storage.delete("docs/a.txt");
      await storage.delete("docs/a.txt");
      expect(await storage.get("docs/a.txt")).toBeNull();
      expect(await storage.head("docs/a.txt")).toBeNull();
    });

    it("lists by prefix in key order with a cursor", async () => {
      const storage = await create();
      for (const key of ["b/2", "a/1", "b/1", "b/3", "c"]) await storage.put(key, key);
      const first = await storage.list({ prefix: "b/", limit: 2 });
      expect(first.objects.map((object) => object.key)).toEqual(["b/1", "b/2"]);
      expect(first.objects[0]).toMatchObject({ size: 3 });
      const second = await storage.list({ prefix: "b/", limit: 2, cursor: first.cursor! });
      expect(second.objects.map((object) => object.key)).toEqual(["b/3"]);
      expect(second.cursor).toBeUndefined();
      expect((await storage.list()).objects).toHaveLength(5);
    });

    it("streams bodies", async () => {
      const storage = await create();
      const body = new Blob(["x".repeat(100_000)]).stream();
      expect(await storage.put("big", body)).toMatchObject({ size: 100_000 });
      expect((await text(storage, "big"))?.length).toBe(100_000);
    });
  });
}
