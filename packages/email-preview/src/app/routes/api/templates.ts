import { createFileRoute } from "@tanstack/react-router";
import { templatesResponse } from "#preview-runtime";

export const Route = createFileRoute("/api/templates")({
  server: { handlers: { GET: () => templatesResponse() } },
});
