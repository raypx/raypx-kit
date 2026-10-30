export const localeConfig = {
  locales: ["en", "zh"] as const,
  defaultLocale: "en" as const,
};

export type DocsLocale = (typeof localeConfig.locales)[number];

export const localeNames = { en: "English", zh: "简体中文" } satisfies Record<DocsLocale, string>;

export const contentI18n = {
  languages: [...localeConfig.locales],
  defaultLanguage: localeConfig.defaultLocale,
  hideLocale: "default-locale" as const,
};

export function getHomePath(locale: DocsLocale = "en"): string {
  return locale === "zh" ? "/zh" : "/";
}

/** The URL owns the render snapshot, including the server and first client render. */
export function getPathLocale(pathname: string): DocsLocale {
  return pathname === "/zh" || pathname === "/zh/" || /^\/zh\/docs(?:\/|$)/.test(pathname)
    ? "zh"
    : "en";
}

/** Home and documentation language switches retain the query and fragment. */
export function localizeSiteUrl(href: string, locale: DocsLocale): string {
  const home = /^(?:\/|\/(?:en|zh)\/?)([?#].*)?$/.exec(href);
  return home ? `${getHomePath(locale)}${home[1] ?? ""}` : localizeDocumentationUrl(href, locale);
}

/** Switch only documentation paths; preserve queries, fragments and external links. */
export function localizeDocumentationUrl(href: string, locale: DocsLocale): string {
  const match = /^(?:\/(?:en|zh))?(\/docs(?:[/?#].*)?)$/.exec(href);
  if (!match) return href;
  return `${locale === "en" ? "" : `/${locale}`}${match[1]}`;
}
