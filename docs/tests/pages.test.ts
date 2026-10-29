import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { checkDocumentLinks } from "../../packages/devkit/src/docs.js";
import {
  documentationPages,
  getContentUrl,
  getSourceUrl,
  navigationMetadata,
  getDocumentationPath,
  getPageMetadata,
  getPageSource,
  getRegisteredSource,
} from "../src/lib/pages.js";
import { chineseContentSources, chinesePageMetadata } from "../src/lib/i18n/pages.js";
import { compareMessageCatalogs } from "../../packages/intl/src/testing.js";
import { getPathLocale, localizeDocumentationUrl } from "../src/lib/i18n/config.js";
import en from "../src/lib/i18n/en.js";
import zh from "../src/lib/i18n/zh.js";

describe("documentation structure", () => {
  it("registers existing canonical sources with unique routes and navigation entries", () => {
    const sources = documentationPages.map((page) => page.sourcePath);
    const slugs = documentationPages.map((page) => page.slug);
    expect(new Set(sources).size).toBe(sources.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const source of sources)
      expect(existsSync(new URL(`../../${source}`, import.meta.url)), source).toBe(true);

    const navigation: string[] = [];
    function visit(directory = "") {
      const key = `${directory}meta.json` as keyof typeof navigationMetadata;
      for (const entry of navigationMetadata[key].pages) {
        const slug = `${directory}${entry}`;
        if (`${slug}/meta.json` in navigationMetadata) visit(`${slug}/`);
        else navigation.push(slug);
      }
    }
    visit();
    expect(navigation.sort()).toEqual(slugs.sort());
  });

  it("keeps relative Markdown links valid across the canonical guides", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    expect(
      checkDocumentLinks(root, ["README.md", ...documentationPages.map((page) => page.sourcePath)]),
    ).toEqual([]);
  });
});

describe("documentation languages", () => {
  it("keeps translated catalogs and every page's metadata complete", () => {
    expect(compareMessageCatalogs(en, zh, "en", "zh")).toEqual([]);
    expect(Object.keys(chinesePageMetadata).sort()).toEqual(
      documentationPages.map((page) => page.slug).sort(),
    );
  });

  it("compiles existing translated files while retaining canonical English fallback", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    expect(checkDocumentLinks(root, Object.values(chineseContentSources))).toEqual([]);
    const overview = documentationPages.find((page) => page.slug === "index")!;
    const intl = documentationPages.find((page) => page.slug === "intl/index")!;
    expect(getPageSource(overview, "zh")).toBe("docs/content/zh/index.md");
    expect(getRegisteredSource(`${root}/docs/content/zh/index.md`).contentLocale).toBe("zh");
    expect(getRegisteredSource(`${root}/packages/intl/README.md`).contentLocale).toBe("en");
    expect(getPageSource(intl, "zh")).toBe(intl.sourcePath);
    expect(getPageMetadata(overview, "zh").title).toBe("概览");
    expect(getDocumentationPath(intl.slug, "zh")).toBe("/zh/docs/intl");
  });

  it.each([
    ["/docs", "zh", "/zh/docs"],
    ["/docs/intl?tab=api#react", "zh", "/zh/docs/intl?tab=api#react"],
    ["/zh/docs/intl?tab=api#react", "en", "/docs/intl?tab=api#react"],
    ["/en/docs/intl", "en", "/docs/intl"],
    ["/zh/docs/intl", "zh", "/zh/docs/intl"],
  ] as const)("switches %s to %s without losing its location", (href, locale, expected) => {
    expect(localizeDocumentationUrl(href, locale)).toBe(expected);
  });

  it.each([
    "#react",
    "?tab=api",
    "/docs-other",
    "/zh/docs-other",
    "https://example.com/docs",
    "mailto:example@example.com",
  ])("leaves non-documentation URLs intact: %s", (href) => {
    expect(localizeDocumentationUrl(href, "zh")).toBe(href);
  });

  it("identifies supported language paths without accepting partial prefixes", () => {
    expect(getPathLocale("/zh/docs/intl")).toBe("zh");
    expect(getPathLocale("/docs/intl")).toBe("en");
    expect(getPathLocale("/zh/docs-other")).toBe("en");
    expect(getPathLocale("/fr/docs")).toBe("en");
  });

  it("keeps canonical and translated Markdown links inside the requested language", () => {
    expect(
      getContentUrl("../../../packages/intl/README.md#react", "docs/content/zh/index.md", "zh"),
    ).toBe("/zh/docs/intl#react");
    expect(getContentUrl("../../docs/README.md", "packages/intl/README.md", "zh")).toBe("/zh/docs");
    expect(getContentUrl("/docs/env?tab=usage#types", "docs/content/zh/index.md", "zh")).toBe(
      "/zh/docs/env?tab=usage#types",
    );
  });
});

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
    expect(getContentUrl("README.md#daily-commands", "docs/development/publishing.md")).toBe(
      "/docs/development#daily-commands",
    );
    expect(getContentUrl("docs/architecture/README.md", "README.md")).toBe("/docs/architecture");
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
    expect(getContentUrl("../README.md", "docs/README.md")).toBe(
      "https://github.com/raypx/raypx-kit/blob/canary/README.md",
    );
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
