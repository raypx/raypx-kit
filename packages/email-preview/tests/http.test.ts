import { createServer as createHttpServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { emailPreview } from "../src/server/plugin.js";
import type { InternalOptions } from "../src/server/plugin.js";

describe("preview HTTP endpoints", () => {
  let root = "";
  let vite: ViteDevServer;
  let http: Server;
  let origin = "";

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "raypx-email-http-")));
    const emails = join(root, "emails");
    await mkdir(join(emails, "static"), { recursive: true });
    await mkdir(join(root, "ui"));
    await writeFile(join(emails, "welcome.tsx"), "export default () => <p>Hello</p>");
    await writeFile(
      join(emails, "static", "logo.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    );
    await writeFile(join(root, "ui", "index.html"), "<!doctype html><html><head></head></html>");
    vite = await createServer({
      configFile: false,
      root,
      appType: "custom",
      logLevel: "silent",
      server: { middlewareMode: true, hmr: false },
      plugins: [
        emailPreview({ dir: "emails", interfaceDirectory: join(root, "ui") } as InternalOptions),
      ],
    });
    http = createHttpServer(vite.middlewares);
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  });
  afterEach(async () => {
    if (http) {
      http.closeAllConnections();
      await new Promise((resolve) => http.close(resolve));
    }
    await vite?.close();
    await rm(root, { recursive: true, force: true });
  });

  it("returns safe uncached metadata and actionable parameter errors", async () => {
    const list = await fetch(`${origin}/__email/api/templates`);
    expect(list.status).toBe(200);
    expect(list.headers.get("cache-control")).toBe("no-store");
    expect(await list.json()).toMatchObject({ templates: [{ id: "welcome.tsx" }] });
    const invalid = await fetch(`${origin}/__email/api/preview`);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: "INVALID_TEMPLATE" } });
    const missing = await fetch(`${origin}/__email/api/preview?template=missing.tsx`);
    expect(missing.status).toBe(404);
  });

  it("serves the interface below its mount point and leaves other paths to the host", async () => {
    const redirect = await fetch(`${origin}/__email?template=welcome.tsx`, { redirect: "manual" });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("/__email/?template=welcome.tsx");
    const page = await fetch(`${origin}/__email/`);
    expect(await page.text()).toContain('<base href="/__email/" />');
    expect((await fetch(`${origin}/__email/assets/..%2Findex.html`)).status).toBe(404);
    expect((await fetch(`${origin}/__email/unknown`)).status).toBe(404);
    expect((await fetch(`${origin}/api/templates`)).status).toBe(404);
  });

  it("serves static assets without caching and rejects traversal", async () => {
    const asset = await fetch(`${origin}/__email/static/logo.svg`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toBe("no-store");
    expect(asset.headers.get("content-type")).toContain("image/svg+xml");
    expect(asset.headers.get("content-security-policy")).toBe("sandbox");
    expect((await fetch(`${origin}/__email/static/..%2Fwelcome.tsx`)).status).toBe(404);
  });

  it("sends an initial revision and closes open streams during shutdown", async () => {
    const response = await fetch(`${origin}/__email/api/events`);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      'event: ready\ndata: {"revision":0}',
    );
    await vite.close();
    expect((await reader.read()).done).toBe(true);
  });
});
