import { describe, expect, it } from "vite-plus/test";

import { createStorage, StorageError } from "../src/index.js";
import { createMemoryDriver } from "../src/memory.js";
import { createLocalSigner, createSignedRequestHandler } from "../src/signed.js";

const secret = "s".repeat(32);
const baseUrl = "https://api.test/files";

function setup(now = () => new Date()) {
  const signer = createLocalSigner({ secret, baseUrl, now });
  const driver = createMemoryDriver({ signer });
  return {
    storage: createStorage(driver, { now }),
    handle: createSignedRequestHandler(driver, signer),
  };
}

const upload = (
  url: string,
  body: NonNullable<RequestInit["body"]>,
  type = "image/png",
  init: RequestInit = {},
) => new Request(url, { method: "PUT", body, headers: { "content-type": type }, ...init });

describe("local signed URLs", () => {
  it("requires a strong secret", () => {
    expect(() => createLocalSigner({ secret: "short", baseUrl })).toThrow(StorageError);
  });

  it("round-trips an upload and a download", async () => {
    const { storage, handle } = setup();
    const signed = await storage.signUpload("users/1/头像.png", {
      contentType: "image/png",
      size: 3,
    });
    expect(signed).toMatchObject({ method: "PUT", headers: { "content-type": "image/png" } });
    expect(signed.url.startsWith(`${baseUrl}/users/1/%E5%A4%B4%E5%83%8F.png?`)).toBe(true);
    const put = await handle(upload(signed.url, "abc"));
    expect(put.status).toBe(200);
    expect(await storage.head("users/1/头像.png")).toMatchObject({
      size: 3,
      contentType: "image/png",
    });

    const download = await storage.signDownload("users/1/头像.png", { filename: "a.png" });
    const response = await handle(new Request(download.url));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toContain('filename="a.png"');
    expect(await response.text()).toBe("abc");
  });

  it("rejects tampering, wrong methods, types and sizes", async () => {
    const { storage, handle } = setup();
    const signed = await storage.signUpload("a.png", { contentType: "image/png", size: 3 });
    const tampered = (name: string, value: string) => {
      const url = new URL(signed.url);
      url.searchParams.set(name, value);
      return url.href;
    };
    expect((await handle(upload(tampered("x-size", "4"), "abcd"))).status).toBe(403);
    expect((await handle(upload(tampered("x-type", "text/html"), "abc", "text/html"))).status).toBe(
      403,
    );
    expect((await handle(upload(signed.url.replace("a.png", "b.png"), "abc"))).status).toBe(403);
    expect((await handle(upload(signed.url, "abc", "text/html"))).status).toBe(403);
    expect((await handle(upload(signed.url, "abcd"))).status).toBe(413);
    expect((await handle(upload(signed.url, "ab"))).status).toBe(403);
    expect((await handle(new Request(signed.url))).status).toBe(405);
    expect((await handle(new Request(`${baseUrl}/a.png`))).status).toBe(403);
    expect((await handle(new Request("https://other.test/files/a.png"))).status).toBe(404);
    expect(await storage.head("a.png")).toBeNull();
  });

  it("rejects bodies that outgrow the signed size without a length header", async () => {
    const { storage, handle } = setup();
    const signed = await storage.signUpload("a.png", { contentType: "image/png", size: 3 });
    const stream = new Blob(["abcdef"]).stream();
    const request = upload(signed.url, stream, "image/png", { duplex: "half" } as RequestInit);
    expect((await handle(request)).status).toBe(413);
  });

  it("expires", async () => {
    let time = new Date("2026-01-01T00:00:00Z");
    const { storage, handle } = setup(() => time);
    await storage.put("a", "x");
    const signed = await storage.signDownload("a", { expiresIn: 60 });
    time = new Date(time.getTime() + 59_000);
    expect((await handle(new Request(signed.url))).status).toBe(200);
    time = new Date(time.getTime() + 1000);
    expect((await handle(new Request(signed.url))).status).toBe(403);
  });

  it("returns 404 for missing downloads", async () => {
    const { storage, handle } = setup();
    const signed = await storage.signDownload("missing");
    expect((await handle(new Request(signed.url))).status).toBe(404);
  });
});
