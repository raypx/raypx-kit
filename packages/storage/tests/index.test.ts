import { describe, expect, it } from "vite-plus/test";

import {
  assertKey,
  contentDisposition,
  createStorage,
  encodeKey,
  readBody,
  StorageError,
  streamOf,
} from "../src/index.js";
import { createMemoryDriver } from "../src/memory.js";

const fixed = new Date("2026-01-01T00:00:00Z");
const signer = {
  signUpload: async (key: string, options: { expiresAt: Date }) => ({
    url: `https://storage.test/${key}`,
    method: "PUT" as const,
    headers: {},
    expiresAt: options.expiresAt,
  }),
  signDownload: async (key: string, options: { expiresAt: Date }) => ({
    url: `https://storage.test/${key}`,
    method: "GET" as const,
    headers: {},
    expiresAt: options.expiresAt,
  }),
  verify: async () => ({ status: 403, reason: "unused" }),
};

const code = async (promise: Promise<unknown>) =>
  promise.then(
    () => "resolved",
    (error: unknown) => (error instanceof StorageError ? error.code : String(error)),
  );

describe("keys", () => {
  it("accepts relative slash paths", () => {
    for (const key of ["a", "users/1/avatar.png", "空间/文件 1.txt", "a".repeat(1024)])
      expect(() => assertKey(key)).not.toThrow();
  });

  it("rejects traversal, absolute, empty and control-character keys", () => {
    for (const key of [
      "",
      "/a",
      "a/",
      "a//b",
      "./a",
      "a/../b",
      "..",
      "a\\b",
      "a\nb",
      "é".repeat(513),
    ])
      expect(() => assertKey(key)).toThrow(StorageError);
  });

  it("encodes segments with RFC 3986", () => {
    expect(encodeKey("a b/c(1)!*'.txt")).toBe("a%20b/c%281%29%21%2A%27.txt");
  });

  it("writes an ASCII fallback and a UTF-8 filename", () => {
    expect(contentDisposition('报告 "v1".pdf')).toBe(
      `attachment; filename="__ _v1_.pdf"; filename*=UTF-8''%E6%8A%A5%E5%91%8A%20%22v1%22.pdf`,
    );
  });
});

describe("bodies", () => {
  it("reads every body type", async () => {
    const decode = async (body: Parameters<typeof readBody>[0]) =>
      new TextDecoder().decode(await readBody(body));
    expect(await decode("hi")).toBe("hi");
    expect(await decode(new TextEncoder().encode("hi").buffer)).toBe("hi");
    expect(await decode(new Blob(["hi"]))).toBe("hi");
    expect(await decode(streamOf(new TextEncoder().encode("hi")))).toBe("hi");
  });

  it("stops reading a stream past the limit", async () => {
    expect(await code(readBody(streamOf(new Uint8Array(5)), 4))).toBe("TOO_LARGE");
  });
});

describe("createStorage", () => {
  it("enforces size and content type before the driver runs", async () => {
    const storage = createStorage(createMemoryDriver(), {
      maxSize: 4,
      contentTypes: ["image/*", "application/pdf"],
    });
    expect(await code(storage.put("a", "12345", { contentType: "image/png" }))).toBe("TOO_LARGE");
    expect(await code(storage.put("a", "1", { contentType: "text/plain" }))).toBe("CONTENT_TYPE");
    expect(await code(storage.put("a", "1"))).toBe("CONTENT_TYPE");
    expect(await code(storage.put("../a", "1", { contentType: "image/png" }))).toBe("INVALID_KEY");
    await storage.put("a", "1234", { contentType: "Image/PNG; charset=binary" });
    await storage.put("b", "1", { contentType: "application/pdf" });
    expect(await storage.head("b")).toMatchObject({ size: 1 });
  });

  it("limits streams of unknown length", async () => {
    const storage = createStorage(createMemoryDriver(), { maxSize: 4 });
    expect(await code(storage.put("a", streamOf(new Uint8Array(5))))).toBe("TOO_LARGE");
    expect(await storage.head("a")).toBeNull();
    await storage.put("a", streamOf(new Uint8Array(4)));
    expect(await storage.head("a")).toMatchObject({ size: 4 });
  });

  it("validates list options", async () => {
    const storage = createStorage(createMemoryDriver());
    expect(await code(storage.list({ limit: 0 }))).toBe("INVALID_OPTIONS");
    expect(await code(storage.list({ limit: 1001 }))).toBe("INVALID_OPTIONS");
    expect(await code(storage.list({ prefix: "../" }))).toBe("INVALID_KEY");
    expect(await storage.list({ prefix: "users/" })).toEqual({ objects: [] });
  });

  it("bounds signed URL lifetimes and binds upload type and size", async () => {
    const storage = createStorage(createMemoryDriver({ signer }), {
      maxSize: 10,
      contentTypes: ["image/png"],
      now: () => fixed,
    });
    const upload = await storage.signUpload("a", { contentType: "image/png", size: 10 });
    expect(upload.expiresAt).toEqual(new Date(fixed.getTime() + 900_000));
    const download = await storage.signDownload("a", { expiresIn: 3600 });
    expect(download.expiresAt).toEqual(new Date(fixed.getTime() + 3_600_000));
    expect(await code(storage.signDownload("a", { expiresIn: 3601 }))).toBe("INVALID_OPTIONS");
    expect(await code(storage.signDownload("a", { expiresIn: 0 }))).toBe("INVALID_OPTIONS");
    expect(await code(storage.signUpload("a", { contentType: "image/png", size: 11 }))).toBe(
      "TOO_LARGE",
    );
    expect(await code(storage.signUpload("a", { contentType: "image/png", size: 1.5 }))).toBe(
      "INVALID_OPTIONS",
    );
    expect(await code(storage.signUpload("a", { contentType: "text/html", size: 1 }))).toBe(
      "CONTENT_TYPE",
    );
  });

  it("reports drivers without signing", async () => {
    const storage = createStorage(createMemoryDriver());
    expect(await code(storage.signDownload("a"))).toBe("SIGNING_UNAVAILABLE");
  });
});
