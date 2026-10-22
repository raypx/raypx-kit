import { Button } from "@raypx-kit/ui/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@raypx-kit/ui/components/ui/tabs";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PreviewResult } from "../../types";
import { outputFilename } from "../lib/preview";
import type { PreviewSearch, PreviewView } from "../lib/preview";
import { usePreviewData } from "../lib/use-preview-data";
import { HtmlSource } from "./html-source";
import { TemplateLibrary } from "./template-library";
import { ThemeSelect } from "./theme-select";

interface PreviewWorkspaceProps {
  search: PreviewSearch;
  onSearchChange: (search: PreviewSearch, replace?: boolean) => void;
}

const views: { id: PreviewView; label: string }[] = [
  { id: "preview", label: "Preview" },
  { id: "html", label: "HTML" },
  { id: "text", label: "Text" },
];

export function PreviewWorkspace({ search, onSearchChange }: PreviewWorkspaceProps) {
  const data = usePreviewData(search.template);
  const [filter, setFilter] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const drawer = useRef<HTMLDialogElement>(null);
  const firstTemplate = data.list?.templates[0]?.id;
  const renderReady = Boolean(data.preview && !data.loading && !data.previewError);
  const outputType = search.view === "text" ? "text" : "HTML";

  useEffect(() => {
    if (!search.template && firstTemplate) {
      onSearchChange({ ...search, template: firstTemplate }, true);
    }
  }, [firstTemplate, search, onSearchChange]);

  useEffect(() => {
    document.title = data.selected
      ? `${data.selected.name} · Email preview · Raypx Kit`
      : "Email preview · Raypx Kit";
  }, [data.selected]);

  useEffect(() => {
    setCopyStatus("");
  }, [search.template, search.view, data.preview?.revision]);

  useEffect(() => {
    if (!copyStatus) return;
    const timeout = window.setTimeout(() => setCopyStatus(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  function selectTemplate(template: string) {
    onSearchChange({ ...search, template });
    drawer.current?.close();
  }

  function selectView(view: PreviewView) {
    onSearchChange({ ...search, view });
  }

  async function copyOutput() {
    if (!data.preview || !renderReady) return;
    try {
      await navigator.clipboard.writeText(
        search.view === "text" ? data.preview.text : data.preview.html,
      );
      setCopyStatus(`${outputType} copied`);
    } catch {
      setCopyStatus(
        search.view === "preview"
          ? "Copy failed. Open HTML and select the output to copy it."
          : "Copy failed. Select and copy the output below.",
      );
    }
  }

  function downloadOutput() {
    if (!data.preview || !renderReady) return;
    const text = search.view === "text";
    const blob = new Blob([text ? data.preview.text : data.preview.html], {
      type: `${text ? "text/plain" : "text/html"};charset=utf-8`,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = outputFilename(data.preview.id, search.view);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const library = (
    <TemplateLibrary
      list={data.list}
      templateId={search.template}
      filter={filter}
      onFilterChange={setFilter}
      onSelect={selectTemplate}
      connection={data.connection}
    />
  );

  let content: ReactNode;
  if (data.listError) {
    content = (
      <WorkspaceState title="Could not load templates" label="Connection error">
        <p>{data.listError}</p>
        <Button variant="outline" type="button" className="button" onClick={data.retry}>
          Retry connection
        </Button>
      </WorkspaceState>
    );
  } else if (!data.list) {
    content = <PreviewSkeleton />;
  } else if (data.list.templates.length === 0) {
    content = (
      <WorkspaceState title="Add an email template" label="No templates found">
        <p>
          Add a React Email template with a default export to <code>{data.list.directory}</code>.
        </p>
        <pre className="example-code">
          {
            "export default function Welcome() {\n  return <p>Welcome aboard.</p>;\n}\n\nWelcome.PreviewProps = {};"
          }
        </pre>
        <p className="state-footnote">
          Save it as <code>welcome.tsx</code>. This workspace updates automatically.
        </p>
      </WorkspaceState>
    );
  } else if (!data.selected) {
    content = (
      <WorkspaceState title="Template not found" label="Template unavailable">
        <p>
          <code>{search.template ?? "No template selected"}</code> is not in the template directory.
        </p>
        <p>Choose another template from the library.</p>
        <Button
          variant="outline"
          type="button"
          className="button"
          onClick={() => firstTemplate && selectTemplate(firstTemplate)}
        >
          Open first template
        </Button>
      </WorkspaceState>
    );
  } else if (data.previewError) {
    content = (
      <WorkspaceState title="This email could not render" label="Template error">
        <p>
          Check <code>{data.selected.id}</code>. Saving a fix will refresh the preview.
        </p>
        <pre className="error-detail">{data.previewError}</pre>
        <Button variant="outline" type="button" className="button" onClick={data.retry}>
          Retry preview
        </Button>
      </WorkspaceState>
    );
  } else if (!data.preview) {
    content = <PreviewSkeleton />;
  } else {
    content = (
      <PreviewOutput preview={data.preview} search={search} renderVersion={data.renderVersion} />
    );
  }

  return (
    <div className="preview-app">
      <a className="skip-link" href="#preview-content">
        Skip to preview
      </a>
      <aside className="desktop-library">{library}</aside>
      <dialog ref={drawer} className="library-dialog" aria-label="Browse email templates">
        <Button
          variant="outline"
          className="button drawer-close"
          type="button"
          onClick={() => drawer.current?.close()}
        >
          Close library
        </Button>
        {library}
      </dialog>
      <main className="preview-main">
        <Tabs
          className="workspace-tabs"
          value={search.view}
          onValueChange={(value) => {
            if (value === "preview" || value === "html" || value === "text") selectView(value);
          }}
        >
          <header className="workspace-header">
            <div className="workspace-title">
              <Button
                variant="outline"
                type="button"
                className="button browse-button"
                onClick={() => drawer.current?.showModal()}
              >
                Browse templates
              </Button>
              <h1>{data.selected?.name ?? "Email preview"}</h1>
              <p className="template-path" title={data.selected?.id ?? data.list?.directory}>
                {data.selected?.id ?? data.list?.directory ?? "Local React Email workspace"}
              </p>
            </div>
            <div className="workspace-controls">
              <ThemeSelect />
              <div className="workspace-status" role="status" aria-live="polite">
                {data.loading
                  ? "Updating preview…"
                  : data.previewError
                    ? "Render failed"
                    : data.preview
                      ? "Preview ready"
                      : ""}
              </div>
            </div>
          </header>
          <div className="workspace-toolbar">
            <TabsList className="view-tabs" aria-label="Email output" activateOnFocus>
              {views.map((view) => (
                <TabsTrigger key={view.id} value={view.id}>
                  {view.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="output-actions">
              <Button
                variant="outline"
                type="button"
                className="button"
                disabled={!renderReady}
                onClick={() => void copyOutput()}
              >
                Copy {outputType}
              </Button>
              <Button
                variant="outline"
                type="button"
                className="button"
                disabled={!renderReady}
                onClick={downloadOutput}
              >
                Download {outputType}
              </Button>
            </div>
          </div>
          {search.view === "preview" && data.selected ? (
            <div className="viewport-toolbar">
              <fieldset className="viewport-options">
                <legend className="sr-only">Preview viewport</legend>
                {(["desktop", "mobile"] as const).map((viewport) => (
                  <label
                    key={viewport}
                    className={search.viewport === viewport ? "viewport-selected" : ""}
                  >
                    <input
                      type="radio"
                      name="viewport"
                      value={viewport}
                      checked={search.viewport === viewport}
                      onChange={() => onSearchChange({ ...search, viewport })}
                    />
                    {viewport === "desktop" ? "Desktop" : "Mobile"}
                  </label>
                ))}
              </fieldset>
              <span className="viewport-size">
                {search.viewport === "desktop" ? "800" : "375"} px
              </span>
            </div>
          ) : null}
          <TabsContent
            key={search.view}
            value={search.view}
            id="preview-content"
            className="preview-content"
            aria-busy={data.loading}
            tabIndex={0}
          >
            {content}
          </TabsContent>
          <div
            className={`copy-feedback${copyStatus ? " copy-feedback-visible" : ""}`}
            role="status"
            aria-live="polite"
          >
            {copyStatus}
          </div>
        </Tabs>
      </main>
    </div>
  );
}

function PreviewOutput({
  preview,
  search,
  renderVersion,
}: {
  preview: PreviewResult;
  search: PreviewSearch;
  renderVersion: number;
}) {
  if (search.view === "html") {
    return <HtmlSource source={preview.formattedHtml} />;
  }
  if (search.view === "text") {
    return (
      <pre className="source-output" aria-label="Plain text output">
        <code>{preview.text || "(This email has no text content.)"}</code>
      </pre>
    );
  }
  return (
    <div className="preview-stage">
      <iframe
        key={`${preview.id}:${preview.revision}:${renderVersion}`}
        className={`email-frame email-frame-${search.viewport}`}
        title={`Email preview: ${preview.id}`}
        srcDoc={preview.html}
        sandbox=""
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function WorkspaceState({
  children,
  title,
  label,
}: {
  children: ReactNode;
  title: string;
  label: string;
}) {
  return (
    <div className="workspace-state">
      <div className="workspace-state-inner">
        <p className="state-kicker">{label}</p>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="preview-stage" role="status" aria-label="Loading email preview">
      <div className="preview-skeleton" aria-hidden="true">
        <div className="skeleton-logo" />
        <div className="skeleton-heading" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-short" />
      </div>
    </div>
  );
}
