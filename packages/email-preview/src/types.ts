/** Internal contracts shared by the preview server and its application. */
export interface PreviewOptions {
  cwd: string;
  directory: string;
  renderTimeoutMs?: number;
}

export interface Template {
  id: string;
  name: string;
  directory: string;
}

export interface TemplateList {
  directory: string;
  templates: Template[];
  revision: number;
}

export interface PreviewResult {
  id: string;
  revision: number;
  html: string;
  formattedHtml: string;
  text: string;
}
