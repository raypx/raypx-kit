import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  fetchPreviewData,
  outputFilename,
  validatePreviewSearch,
  withPreviewBase,
} from "../src/ui/lib/preview";

afterEach(() => vi.unstubAllGlobals());

describe("preview address state", () => {
  it("keeps a nested template deep link and its output preferences", () => {
    expect(
      validatePreviewSearch({
        template: "transactional/welcome.tsx",
        view: "text",
        viewport: "mobile",
      }),
    ).toEqual({ template: "transactional/welcome.tsx", view: "text", viewport: "mobile" });
  });

  it("recovers malformed search values to a usable default workspace", () => {
    expect(
      validatePreviewSearch({ template: ["welcome.tsx"], view: "source", viewport: "wide" }),
    ).toEqual({
      view: "preview",
      viewport: "desktop",
    });
    expect(validatePreviewSearch({ template: "" })).not.toHaveProperty("template");
  });

  it("points sandboxed previews at a mounted static directory without touching other URLs", () => {
    const html = `<img src="/static/logo.png"><a href="https://x.test/static/y">y</a><div style="background:url(/static/bg.png)"></div>`;
    expect(withPreviewBase(html, "/")).toBe(html);
    expect(withPreviewBase(html, "/__email/")).toBe(
      `<img src="/__email/static/logo.png"><a href="https://x.test/static/y">y</a><div style="background:url(/__email/static/bg.png)"></div>`,
    );
  });

  it("downloads HTML for the visual view and preserves dotted template names", () => {
    expect(outputFilename("transactional/welcome.en.tsx", "preview")).toBe("welcome.en.html");
    expect(outputFilename("transactional/welcome.en.tsx", "text")).toBe("welcome.en.txt");
  });
});

describe("preview API boundary", () => {
  it("does not cache template responses and forwards cancellation", async () => {
    const value = { directory: "/project/emails", templates: [], revision: 1 };
    const fetch = vi.fn().mockResolvedValue(Response.json(value));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    await expect(fetchPreviewData("/api/templates", controller.signal)).resolves.toEqual(value);
    expect(fetch).toHaveBeenCalledWith("/api/templates", {
      signal: controller.signal,
      cache: "no-store",
    });
  });

  it("shows the server diagnostic for a template rendering failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: "RENDER_ERROR", message: "welcome.tsx has no default export." } },
            { status: 422 },
          ),
        ),
    );
    await expect(
      fetchPreviewData("/api/preview?template=welcome.tsx", new AbortController().signal),
    ).rejects.toThrow("welcome.tsx has no default export.");
  });

  it("reports the HTTP status when a failed response has no diagnostic", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}, { status: 503 })));
    await expect(fetchPreviewData("/api/templates", new AbortController().signal)).rejects.toThrow(
      "Request failed (503).",
    );
  });

  it("reports the HTTP status when the server fails before reaching the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("The preview server could not handle this request.", { status: 500 }),
        ),
    );
    await expect(fetchPreviewData("/api/templates", new AbortController().signal)).rejects.toThrow(
      "Request failed (500).",
    );
  });

  it("rejects a successful response that is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html></html>")));
    await expect(fetchPreviewData("/api/templates", new AbortController().signal)).rejects.toThrow(
      "The preview server returned an invalid response.",
    );
  });

  it("preserves abort failures so callers can ignore superseded requests", async () => {
    const error = new DOMException("The request was aborted.", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(fetchPreviewData("/api/templates", new AbortController().signal)).rejects.toBe(
      error,
    );
  });

  it("rejects a superseded response even when cancellation occurs while decoding its body", async () => {
    const controller = new AbortController();
    const obsoletePreview = { id: "welcome.tsx", revision: 1, html: "old HTML", text: "old text" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => {
          controller.abort();
          return JSON.stringify(obsoletePreview);
        },
      }),
    );
    await expect(
      fetchPreviewData("/api/preview?template=welcome.tsx", controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
