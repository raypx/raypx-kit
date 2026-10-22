import { createFileRoute } from "@tanstack/react-router";
import { previewResponse } from "#preview-runtime";

export const Route = createFileRoute("/api/preview")({
  server: { handlers: { GET: ({ request }) => previewResponse(request) } },
});
