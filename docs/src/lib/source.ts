import { loader } from "fumadocs-core/source";
import type { MetaData, StaticSource } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";
import { z } from "zod";
import {
  documentationPages,
  getNavigationMetadata,
  getPageMetadata,
  getPageSource,
  getRegisteredSource,
} from "./pages";
import { contentI18n, localeConfig } from "./i18n/config";

export { getSourceUrl } from "./pages";

export const docs = defineDocs({
  dir: "..",
  docs: {
    async: true,
    files: [
      "docs/README.md",
      "docs/content/zh/**/*.md",
      "docs/architecture/*.md",
      "docs/drizzle/*.md",
      "docs/email-preview/*.md",
      "docs/intl/*.md",
      "docs/development/*.md",
      "packages/codemods/README.md",
      "packages/devkit/README.md",
      "packages/drizzle/README.md",
      "packages/drizzle/NOTICE.md",
      "packages/drizzle-kit/README.md",
      "packages/email-preview/README.md",
      "packages/env/README.md",
      "packages/intl/README.md",
      "packages/analytics/README.md",
      "packages/logger/README.md",
      "packages/notifications/README.md",
      "packages/security/README.md",
      "packages/storage/README.md",
      "packages/themes/README.md",
      "packages/tsconfig/README.md",
      "packages/ui/README.md",
    ],
    schema: ({ path }) =>
      z
        .object({ steps: z.boolean().optional() })
        .transform((options) => ({ ...getRegisteredSource(path), ...options })),
  },
  meta: { files: [] },
});

const contentSource: StaticSource<{
  pageData: (typeof docs.docs)[number];
  metaData: MetaData;
}> = {
  files: localeConfig.locales.flatMap((locale) => [
    ...documentationPages.map((registration) => {
      const sourcePath = getPageSource(registration, locale);
      const page = docs.docs.find((entry) => entry.sourcePath === sourcePath);
      if (!page) throw new Error(`Missing documentation content: ${sourcePath}`);
      return {
        type: "page" as const,
        path: `${registration.slug}.${locale}.md`,
        absolutePath: page.info.fullPath,
        data: { ...page, ...getPageMetadata(registration, locale), sourcePath },
      };
    }),
    ...Object.entries(getNavigationMetadata(locale)).map(([path, data]) => ({
      type: "meta" as const,
      path: path.replace(/\.json$/, `.${locale}.json`),
      data,
    })),
  ]),
};

export const source = loader({
  source: contentSource,
  baseUrl: "/docs",
  i18n: contentI18n,
});
