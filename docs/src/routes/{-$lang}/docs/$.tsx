import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "@fumadocs/base-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
} from "@fumadocs/base-ui/layouts/docs/page";
import { Suspense, use } from "react";
import { z } from "zod";
import { getMDXComponents } from "../../../components/mdx";
import { baseOptions } from "../../../lib/layout";
import { docs, getSourceUrl, source } from "../../../lib/source";
import { localeRuntime, useTranslations } from "../../../lib/i18n/client";
import { localeConfig, localizeDocumentationUrl } from "../../../lib/i18n/config";
import { getDocumentationPath } from "../../../lib/pages";

const loadPage = createServerFn({ method: "GET" })
  .validator(z.object({ slugs: z.array(z.string()), locale: z.enum(localeConfig.locales) }))
  .handler(async ({ data: { slugs, locale } }) => {
    const page = source.getPage(slugs, locale);
    if (!page) throw notFound();

    return {
      path: page.data.info.path,
      title: page.data.title,
      description: page.data.description ?? "",
      sourceUrl: getSourceUrl(page.data.sourcePath),
      contentLocale: page.data.contentLocale,
      locale,
      slug: page.data.slug,
      pageTree: await source.serializePageTree(source.getPageTree(locale)),
    };
  });

export const Route = createFileRoute("/{-$lang}/docs/$")({
  beforeLoad: ({ params, location }) => {
    if (params.lang && !localeRuntime.isLocale(params.lang)) throw notFound();
    if (params.lang === localeRuntime.defaultLocale)
      throw redirect({ href: localizeDocumentationUrl(location.href, "en"), replace: true });
  },
  loader: async ({ params }) => {
    const locale = params.lang === "zh" ? "zh" : "en";
    const slugs = params._splat?.split("/").filter(Boolean) ?? [];
    if (!source.getPage(slugs, locale)) throw notFound();
    const data = await loadPage({ data: { slugs, locale } });
    await docs.getPage(data.path)?.preload();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} | Raypx Kit` },
          { name: "description", content: loaderData.description },
          { property: "og:title", content: `${loaderData.title} | Raypx Kit` },
          { property: "og:description", content: loaderData.description },
          { property: "og:type", content: "article" },
        ]
      : [],
    links: loaderData
      ? localeConfig.locales.map((locale) => ({
          rel: "alternate",
          hrefLang: locale,
          href: getDocumentationPath(loaderData.slug, locale),
        }))
      : [],
  }),
  component: DocumentationPage,
});

function PageContent({
  path,
  sourceUrl,
  title,
  description,
  contentLocale,
  locale,
  slug,
}: Omit<Awaited<ReturnType<typeof loadPage>>, "pageTree">) {
  const t = useTranslations("page");
  const page = docs.getPage(path);
  if (!page) throw new Error(`Documentation content is unavailable: ${path}`);
  const { toc } = use(page.load());
  const Content = page.body;

  return (
    <DocsPage toc={toc}>
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription>{description}</DocsDescription>
      <div className="mb-6 flex border-b border-fd-border pb-4">
        <EditOnGitHub href={sourceUrl} target="_blank" rel="noreferrer">
          {t("source")}
        </EditOnGitHub>
      </div>
      {contentLocale !== locale && (
        <aside
          role="note"
          className="mb-6 rounded-lg border border-fd-border bg-fd-muted px-4 py-3 text-sm text-fd-muted-foreground"
        >
          <p>
            {t("fallback")}{" "}
            <a
              href={getDocumentationPath(slug, "en")}
              className="font-medium text-fd-primary underline underline-offset-4"
            >
              {t("english")}
            </a>
          </p>
        </aside>
      )}
      <DocsBody lang={contentLocale}>
        <Content components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

function DocumentationPage() {
  const data = useFumadocsLoader(Route.useLoaderData());
  return (
    <DocsLayout {...baseOptions(data.locale)} tree={data.pageTree}>
      <Suspense>
        <PageContent {...data} />
      </Suspense>
    </DocsLayout>
  );
}
