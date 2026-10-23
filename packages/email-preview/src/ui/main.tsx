import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { ThemeProvider } from "@raypx-kit/themes";
import { Button } from "@raypx-kit/ui/components/ui/button";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PreviewWorkspace } from "./components/preview-workspace";
import { errorMessage, themeStorageKey, validatePreviewSearch } from "./lib/preview";
import "./styles.css";

const rootRoute = createRootRoute({
  component: () => (
    <ThemeProvider storageKey={themeStorageKey}>
      <Outlet />
    </ThemeProvider>
  ),
  notFoundComponent: () => (
    <main className="standalone-state">
      <p className="state-kicker">Page not found</p>
      <h1>This preview page does not exist.</h1>
      <Link
        to="/"
        search={{ view: "preview", viewport: "desktop" }}
        className="button button-primary"
      >
        Browse templates
      </Link>
    </main>
  ),
  errorComponent: ({ error, reset }) => (
    <main className="standalone-state">
      <p className="state-kicker">Preview error</p>
      <h1>The workspace could not load.</h1>
      <pre className="error-detail">{errorMessage(error)}</pre>
      <Button variant="outline" type="button" className="button" onClick={reset}>
        Retry workspace
      </Button>
    </main>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: validatePreviewSearch,
  component: PreviewPage,
});

function PreviewPage() {
  const search = indexRoute.useSearch();
  const navigate = indexRoute.useNavigate();
  return (
    <PreviewWorkspace
      search={search}
      onSearchChange={(next, replace = false) => {
        void navigate({ search: next, replace });
      }}
    />
  );
}

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute]),
  // The server injects <base> with the mount point, such as /__email/.
  basepath: new URL(document.baseURI).pathname.replace(/\/$/, "") || "/",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
