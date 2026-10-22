import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { highlightHtml } from "../lib/highlight-html";

type HighlightedLines = Awaited<ReturnType<typeof highlightHtml>>;

export function HtmlSource({ source }: { source: string }) {
  const [highlighted, setHighlighted] = useState<{
    source: string;
    lines: HighlightedLines;
  }>();

  useEffect(() => {
    let active = true;
    // Only the HTML tab loads the grammar and themes. The current source remains
    // readable while loading, and a superseded result cannot replace new output.
    void import("../lib/highlight-html")
      .then(({ highlightHtml }) => highlightHtml(source))
      .then((lines) => {
        if (active) setHighlighted({ source, lines });
      })
      .catch(() => {
        if (active) setHighlighted(undefined);
      });
    return () => {
      active = false;
    };
  }, [source]);

  const lines =
    highlighted?.source === source
      ? highlighted.lines
      : source.split(/\r?\n/).map((content) => [{ content, offset: 0, htmlStyle: undefined }]);

  return (
    <pre className="source-output source-output-html" aria-label="Rendered HTML">
      <code>
        {lines.map((tokens, index) => (
          <span className="source-line" key={index}>
            <span className="source-line-number" aria-hidden="true">
              {index + 1}
            </span>
            {tokens.map((token, tokenIndex) => (
              <span
                key={tokenIndex}
                className="source-token"
                style={token.htmlStyle as CSSProperties | undefined}
              >
                {token.content}
              </span>
            ))}
            {index < lines.length - 1 ? "\n" : null}
          </span>
        ))}
      </code>
    </pre>
  );
}
