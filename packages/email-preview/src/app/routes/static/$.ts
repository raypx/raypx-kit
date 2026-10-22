import { createFileRoute } from "@tanstack/react-router";
import { staticResponse } from "#preview-runtime";

export const Route = createFileRoute("/static/$")({
  server: { handlers: { GET: ({ params }) => staticResponse(params._splat ?? "") } },
});
