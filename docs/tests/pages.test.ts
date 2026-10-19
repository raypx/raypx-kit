import { describe, expect, it } from "vite-plus/test";
import { getContentUrl, getSourceUrl } from "../src/lib/pages.js";

describe("documentation source links", () => {
  it("links source files to the Raypx Kit repository and encodes path segments", () => {
    expect(getSourceUrl("docs/guides/source link.md")).toBe(
      "https://github.com/raypx/raypx-kit/blob/canary/docs/guides/source%20link.md",
    );
  });

  it("maps canonical relative Markdown links to site routes with query and fragment", () => {
    expect(
      getContentUrl(
        "../../packages/env/README.md?view=api#usage",
        "docs/development/publishing.md",
      ),
    ).toBe("/docs/env?view=api#usage");
    expect(getContentUrl("../README.md", "docs/README.md")).toBe("/docs/development");
    expect(getContentUrl("../../docs/README.md", "packages/env/README.md")).toBe("/docs");
  });

  it("rewrites registered absolute source links in the new repository", () => {
    expect(
      getContentUrl(
        "https://github.com/raypx/raypx-kit/blob/canary/packages/intl/README.md#react",
        "docs/README.md",
      ),
    ).toBe("/docs/intl#react");
  });

  it("keeps unregistered repository files as canonical GitHub links", () => {
    expect(
      getContentUrl("../../packages/env/src/index.ts#L1", "docs/development/publishing.md"),
    ).toBe("https://github.com/raypx/raypx-kit/blob/canary/packages/env/src/index.ts#L1");
  });

  it.each(["#usage", "?tab=api", "/docs/env#usage", "/docs?tab=overview"])(
    "preserves in-page and site links: %s",
    (href) => {
      expect(getContentUrl(href, "docs/README.md")).toBe(href);
    },
  );

  it.each([
    "https://github.com/example/another-toolkit/blob/main/packages/env/README.md",
    "https://github.com/raypx/raypx-kit/blob/canaryline/packages/env/README.md",
    "https://github.com/raypx/raypx-kit/tree/canary/packages/env",
    "https://example.com/docs/env",
    "mailto:maintainer@example.com",
  ])("preserves upstream and external links: %s", (href) => {
    expect(getContentUrl(href, "docs/README.md")).toBe(href);
  });
});
