import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { HtmlSource } from "../src/ui/components/html-source";

describe("HTML source display", () => {
  it("shows source as escaped text with decorative line numbers", () => {
    const markup = renderToStaticMarkup(
      createElement(HtmlSource, { source: '<script>alert("email")</script>\n<img src=x>' }),
    );
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).toContain('aria-hidden="true">2</span>');
  });
});
