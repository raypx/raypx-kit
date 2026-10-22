import { Button } from "@raypx-kit/ui/components/ui/button";
import { Input } from "@raypx-kit/ui/components/ui/input";
import { useId } from "react";
import type { Template, TemplateList } from "../../types";

interface TemplateLibraryProps {
  list: TemplateList | null;
  templateId: string | undefined;
  filter: string;
  onFilterChange: (filter: string) => void;
  onSelect: (id: string) => void;
  connection: "connecting" | "live" | "reconnecting";
}

export function TemplateLibrary({
  list,
  templateId,
  filter,
  onFilterChange,
  onSelect,
  connection,
}: TemplateLibraryProps) {
  const searchId = useId();
  const filtered = (list?.templates ?? []).filter((template) =>
    template.id.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
  );
  const groups = new Map<string, Template[]>();
  for (const template of filtered) {
    const entries = groups.get(template.directory) ?? [];
    entries.push(template);
    groups.set(template.directory, entries);
  }
  return (
    <div className="template-library">
      <div className="library-brand">
        <span className="brand-mark" aria-hidden="true">
          @
        </span>
        <div>
          <span className="brand-name">Raypx Kit</span>
          <span className="brand-description">Email preview</span>
        </div>
      </div>
      <div className="library-heading">
        <h2>Templates</h2>
        <span className="template-count">{list?.templates.length ?? "…"}</span>
      </div>
      <div className="library-search">
        <label htmlFor={searchId} className="sr-only">
          Filter templates by path
        </label>
        <Input
          id={searchId}
          type="search"
          placeholder="Filter templates…"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <nav className="template-navigation" aria-label="Email templates">
        {!list ? (
          <div className="library-skeleton" aria-label="Loading templates">
            <span />
            <span />
            <span />
          </div>
        ) : filtered.length === 0 ? (
          <div className="library-empty">
            <p>{filter ? "No matching templates." : "Your templates will appear here."}</p>
            {filter ? (
              <Button
                variant="ghost"
                type="button"
                className="text-button"
                onClick={() => onFilterChange("")}
              >
                Clear filter
              </Button>
            ) : null}
          </div>
        ) : (
          [...groups].map(([directory, templates]) => (
            <div className="template-group" key={directory}>
              {directory ? (
                <p className="directory-name" title={directory}>
                  {directory}
                </p>
              ) : null}
              <ul>
                {templates.map((template) => (
                  <li key={template.id}>
                    <Button
                      variant="ghost"
                      type="button"
                      className="template-link"
                      aria-current={templateId === template.id ? "page" : undefined}
                      title={template.id}
                      onClick={() => onSelect(template.id)}
                    >
                      <span className="template-file-icon" aria-hidden="true">
                        〈〉
                      </span>
                      <span className="template-name">{template.name}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </nav>
      <div className="library-footer">
        <span className={`connection-dot connection-${connection}`} aria-hidden="true" />
        <span role="status">
          {connection === "live"
            ? "Watching templates"
            : connection === "reconnecting"
              ? "Reconnecting…"
              : "Connecting…"}
        </span>
      </div>
    </div>
  );
}
