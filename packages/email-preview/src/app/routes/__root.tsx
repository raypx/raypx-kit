import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { ThemeProvider, ThemeScript } from "@raypx-kit/themes";
import { Button } from "@raypx-kit/ui/components/ui/button";
import { errorMessage } from "../lib/preview";
import stylesheet from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Email preview · Raypx Kit" },
      { name: "description", content: "Preview and inspect your local React Email templates." },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "stylesheet", href: stylesheet }],
  }),
  component: RootDocument,
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

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <ThemeScript storageKey="raypx-email-theme" />
      </head>
      <body>
        <ThemeProvider storageKey="raypx-email-theme">
          <Outlet />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
