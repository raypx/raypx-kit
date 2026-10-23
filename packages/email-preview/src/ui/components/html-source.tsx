export function HtmlSource({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  return (
    <pre className="source-output source-output-html" aria-label="Rendered HTML">
      <code>
        {lines.map((line, index) => (
          <span className="source-line" key={index}>
            <span className="source-line-number" aria-hidden="true">
              {index + 1}
            </span>
            {line}
            {index < lines.length - 1 ? "\n" : null}
          </span>
        ))}
      </code>
    </pre>
  );
}
