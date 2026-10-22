import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { HtmlSource } from "../src/app/components/html-source";
import { highlightHtml } from "../src/app/lib/highlight-html";

describe("HTML source display", () => {
  it("preserves email markup and conditional comments when tokenizing for both themes", async () => {
    const source = '<!--[if mso]><table><![endif]-->\n<a href="https://example.com">A &amp; B</a>';
    const lines = await highlightHtml(source);
    expect(lines.map((line) => line.map((token) => token.content).join("")).join("\n")).toBe(
      source,
    );
    expect(lines.flat().some((token) => token.htmlStyle?.["--shiki-light"])).toBe(true);
    expect(lines.flat().some((token) => token.htmlStyle?.["--shiki-dark"])).toBe(true);
  });

  it("shows source as escaped text before highlighting, with decorative line numbers", () => {
    const markup = renderToStaticMarkup(
      createElement(HtmlSource, { source: '<script>alert("email")</script>\n<img src=x>' }),
    );
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).toContain('aria-hidden="true">2</span>');
  });
});
