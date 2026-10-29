import { createLocaleRuntime } from "@raypx-kit/intl";
import { createIntlClient } from "@raypx-kit/intl/client";
import { localeConfig } from "./config";
import en from "./en";
import zh from "./zh";

export const localeRuntime = createLocaleRuntime(localeConfig);
export const catalogs = { en, zh };
export const { IntlProvider, useLocale, useTranslations } = createIntlClient<typeof en>()(
  localeRuntime,
  { timeZone: "UTC" },
);

/** Bridge Fumadocs' public translation keys to the application's typed ICU catalog. */
export function useFumadocsTranslations() {
  const t = useTranslations("fumadocs");
  const keys = {
    "Choose a language(language switcher)": "chooseLanguage",
    "Choose a language(language switcher)(aria-label)": "chooseLanguage",
    "Language(language switcher)": "language",
    "Search(search dialog)": "search",
    "Search(search trigger)": "search",
    "Open Search(search trigger)(aria-label)": "openSearch",
    "Close Search(search dialog)(aria-label)": "closeSearch",
    "Open Sidebar(aria-label)": "openSidebar",
    "Open Sidebar(sidebar)(aria-label)": "openSidebar",
    "Close Sidebar(aria-label)": "closeSidebar",
    "Close Sidebar(sidebar)(aria-label)": "closeSidebar",
    "Collapse Sidebar(sidebar)(aria-label)": "collapseSidebar",
    "Hide Sidebar(sidebar)": "hideSidebar",
    "Show Sidebar(sidebar)": "showSidebar",
    "Toggle Theme(theme switcher)(aria-label)": "toggleTheme",
    "Toggle Menu(home layout header)(aria-label)": "toggleMenu",
    "Theme(site menu)": "theme",
    "Light(theme switcher)(aria-label)": "light",
    "Dark(theme switcher)(aria-label)": "dark",
    "System(theme switcher)(aria-label)": "system",
    "On this page(table of contents)": "onThisPage",
    "Table of Contents(inline table of contents)": "tableOfContents",
    "No Headings(table of contents)": "noHeadings",
    "Previous Page(pagination)": "previousPage",
    "Next Page(pagination)": "nextPage",
    "Copy Text(code block)(aria-label)": "copyText",
    "Copied Text(code block)(aria-label)": "copiedText",
    "Copy Anchor Link(heading anchor)(aria-label)": "copyAnchor",
    "Copied Anchor Link(heading anchor)(aria-label)": "copiedAnchor",
    "Copy Link(accordion)(aria-label)": "copyLink",
    "Copied Link(accordion)(aria-label)": "copiedLink",
    "Edit on GitHub(edit page)": "edit",
    "Last updated on(page footer)": "lastUpdated",
    "No results found(search dialog)": "noResults",
    "Search failed(search dialog)": "searchFailed",
    "Options(aria-label)": "options",
  } satisfies Record<string, keyof typeof en.fumadocs>;
  return Object.fromEntries(Object.entries(keys).map(([key, message]) => [key, t(message)]));
}
