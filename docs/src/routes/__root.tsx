import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { RootProvider } from "@fumadocs/base-ui/provider/tanstack";
import { ThemeProvider, ThemeScript } from "@raypx-kit/themes";
import type { ReactNode } from "react";
import DocsSearchDialog from "../components/search";
import { ThemeKeyboardShortcut } from "../components/theme-switch";
import { docsTheme } from "../lib/theme";
import {
  catalogs,
  IntlProvider,
  localeRuntime,
  useFumadocsTranslations,
  useLocale,
} from "../lib/i18n/client";
import { getPathLocale, localeNames, localizeDocumentationUrl } from "../lib/i18n/config";
import appCss from "../styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Raypx Kit" },
      {
        name: "description",
        content:
          "Reusable TypeScript libraries, complete capability inventories and extension designs.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootDocument,
});

function RootDocument() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const locale = getPathLocale(pathname);
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ThemeScript {...docsTheme} />
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider {...docsTheme}>
          <ThemeKeyboardShortcut />
          <IntlProvider locale={locale} messages={catalogs[locale]}>
            <DocumentationProviders>
              <Outlet />
            </DocumentationProviders>
          </IntlProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

function DocumentationProviders({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const router = useRouter();
  const translations = useFumadocsTranslations();
  return (
    <RootProvider
      theme={{ enabled: false }}
      search={{ SearchDialog: DocsSearchDialog }}
      i18n={{
        locale,
        translations,
        locales: localeRuntime.locales.map((value) => ({
          locale: value,
          name: localeNames[value],
        })),
        onLocaleChange: (value) => {
          if (!localeRuntime.isLocale(value)) return;
          const href = localizeDocumentationUrl(
            `${window.location.pathname}${window.location.search}${window.location.hash}`,
            value,
          );
          void router.navigate({ href });
        },
      }}
    >
      {children}
    </RootProvider>
  );
}
