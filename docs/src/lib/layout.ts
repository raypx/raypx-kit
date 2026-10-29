import type { BaseLayoutProps } from "@fumadocs/base-ui/layouts/shared";
import { getDocumentationPath } from "./pages";
import type { DocsLocale } from "./i18n/config";
import { DocsThemeSwitch } from "../components/theme-switch";

export function baseOptions(locale: DocsLocale): BaseLayoutProps {
  return {
    nav: { title: "Raypx Kit", url: getDocumentationPath("index", locale) },
    githubUrl: "https://github.com/raypx/raypx-kit",
    slots: { themeSwitch: DocsThemeSwitch },
  };
}
