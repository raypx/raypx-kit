import type { BaseLayoutProps } from "@fumadocs/base-ui/layouts/shared";
import { getHomePath, localeConfig, type DocsLocale } from "./i18n/config";
import { catalogs } from "./i18n/client";
import { DocsThemeSwitch } from "../components/theme-switch";

export function baseOptions(locale: DocsLocale): BaseLayoutProps {
  return {
    nav: { title: "Raypx Kit", url: getHomePath(locale) },
    githubUrl: "https://github.com/raypx/raypx-kit",
    slots: { themeSwitch: DocsThemeSwitch },
  };
}

export function getHomeHead(locale: DocsLocale) {
  const messages = catalogs[locale].home;
  return {
    meta: [
      { title: messages.metaTitle },
      { name: "description", content: messages.description },
      { property: "og:title", content: "Raypx Kit" },
      { property: "og:description", content: messages.description },
      { property: "og:type", content: "website" },
    ],
    links: localeConfig.locales.map((value) => ({
      rel: "alternate",
      hrefLang: value,
      href: getHomePath(value),
    })),
  };
}
