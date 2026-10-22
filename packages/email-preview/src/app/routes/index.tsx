import { createFileRoute } from "@tanstack/react-router";
import { PreviewWorkspace } from "../components/preview-workspace";
import { validatePreviewSearch } from "../lib/preview";

export const Route = createFileRoute("/")({
  validateSearch: validatePreviewSearch,
  component: PreviewPage,
});

function PreviewPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PreviewWorkspace
      search={search}
      onSearchChange={(next, replace = false) => {
        void navigate({ search: next, replace });
      }}
    />
  );
}
