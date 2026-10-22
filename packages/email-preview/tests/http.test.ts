import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { initializePreview, closePreview } from "../src/http/runtime.js";
import {
  eventsResponse,
  previewResponse,
  staticResponse,
  templatesResponse,
} from "../src/http/handlers.js";

describe("preview HTTP endpoints", () => {
  let root = "";
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "raypx-email-http-"));
    await mkdir(join(root, "static"));
    await writeFile(join(root, "welcome.tsx"), "export default () => <p>Hello</p>");
    await writeFile(join(root, "static", "logo.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    await initializePreview({ cwd: root, directory: root });
  });
  afterEach(async () => {
    await closePreview();
    await rm(root, { recursive: true, force: true });
  });

  it("returns safe uncached metadata and actionable parameter errors", async () => {
    const list = await templatesResponse();
    expect(list.status).toBe(200);
    expect(list.headers.get("cache-control")).toBe("no-store");
    expect(await list.json()).toMatchObject({ templates: [{ id: "welcome.tsx" }] });
    const invalid = await previewResponse(new Request("http://localhost/api/preview"));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: "INVALID_TEMPLATE" } });
    const missing = await previewResponse(
      new Request("http://localhost/api/preview?template=missing.tsx"),
    );
    expect(missing.status).toBe(404);
  });

  it("serves static assets without caching and rejects traversal", async () => {
    const asset = await staticResponse("logo.svg");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toBe("no-store");
    expect(asset.headers.get("content-type")).toContain("image/svg+xml");
    expect((await staticResponse("../welcome.tsx")).status).toBe(404);
  });

  it("sends an initial revision and supports reader cancellation", async () => {
    const response = eventsResponse(new Request("http://localhost/api/events"));
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      'event: ready\ndata: {"revision":0}',
    );
    await reader.cancel();
  });

  it("closes open SSE connections during server shutdown", async () => {
    const response = eventsResponse(new Request("http://localhost/api/events"));
    const reader = response.body!.getReader();
    await reader.read();
    await closePreview();
    expect((await reader.read()).done).toBe(true);
  });
});
