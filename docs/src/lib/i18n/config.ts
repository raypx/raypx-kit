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

/** The URL owns the render snapshot, including the server and first client render. */
export function getPathLocale(pathname: string): DocsLocale {
  return /^\/zh\/docs(?:\/|$)/.test(pathname) ? "zh" : "en";
}

/** Switch only documentation paths; preserve queries, fragments and external links. */
export function localizeDocumentationUrl(href: string, locale: DocsLocale): string {
  const match = /^(?:\/(?:en|zh))?(\/docs(?:[/?#].*)?)$/.exec(href);
  if (!match) return href;
  return `${locale === "en" ? "" : `/${locale}`}${match[1]}`;
}
