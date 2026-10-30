import { CodeBlock, Pre } from "@fumadocs/base-ui/components/codeblock";
import { buttonVariants } from "@fumadocs/base-ui/components/ui/button";
import { HomeLayout } from "@fumadocs/base-ui/layouts/home";
import Link from "fumadocs-core/link";
import { ArrowDown, ArrowRight, ArrowUpRight, FileCode2 } from "lucide-react";
import { baseOptions } from "../lib/layout";
import {
  documentationPages,
  getDocumentationPath,
  getPageMetadata,
  getSourceUrl,
} from "../lib/pages";
import { useLocale, useTranslations } from "../lib/i18n/client";
import { getHomePath } from "../lib/i18n/config";

const packageGroups = [
  {
    title: "application",
    slugs: ["env/index", "intl/index", "logger/index", "security/index", "storage/index"],
  },
  {
    title: "interface",
    slugs: [
      "ui/index",
      "themes/index",
      "email-preview/index",
      "notifications/index",
      "analytics/index",
    ],
  },
  {
    title: "tooling",
    slugs: [
      "drizzle/index",
      "drizzle-kit/index",
      "devkit/index",
      "codemods/index",
      "tsconfig/index",
    ],
  },
] as const;

const envExample = `import { createEnv, z } from "@raypx-kit/env";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
  },
  runtimeEnv: process.env,
});`;

export function HomePage() {
  const locale = useLocale();
  const t = useTranslations("home");
  return (
    <HomeLayout
      {...baseOptions(locale)}
      links={[
        { text: t("documentation"), url: getDocumentationPath("index", locale) },
        { text: t("packages"), url: `${getHomePath(locale)}#packages`, active: "none" },
      ]}
    >
      <div className="home-content">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-intro">
            <p className="home-scope">@raypx-kit/*</p>
            <h1 id="home-title">
              <span>{t("title")}</span>
              <span className="home-title-accent">{t("titleSuffix")}</span>
            </h1>
            <p className="home-description">{t("description")}</p>
            <div className="home-actions">
              <Link
                href={getDocumentationPath("index", locale)}
                className={buttonVariants({ variant: "primary", className: "h-11 gap-2 px-5" })}
              >
                {t("readDocs")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="#packages"
                className={buttonVariants({ variant: "ghost", className: "h-11 gap-2 px-5" })}
              >
                {t("explore")}
                <ArrowDown aria-hidden="true" className="size-4" />
              </Link>
            </div>
            <Link
              className="home-release"
              href={getDocumentationPath("development/changesets", locale)}
            >
              {t("release")}
            </Link>
          </div>
          <aside className="home-example" aria-label={t("example")}>
            <CodeBlock
              title="env.ts"
              icon={<FileCode2 aria-hidden="true" className="size-4" />}
              viewportProps={{ "aria-label": t("example") }}
            >
              <Pre>
                <code>{envExample}</code>
              </Pre>
            </CodeBlock>
            <div className="home-example-caption">
              <span>{t("example")}</span>
              <Link href={getDocumentationPath("env/index", locale)}>
                {t("exampleGuide")} <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            </div>
          </aside>
        </section>

        <section id="packages" className="home-packages" aria-labelledby="packages-title">
          <div className="home-section-heading">
            <h2 id="packages-title">{t("packageTitle")}</h2>
            <p>{t("packageDescription")}</p>
          </div>
          <div className="home-package-groups">
            {packageGroups.map((group) => (
              <section
                key={group.title}
                className="home-package-group"
                aria-labelledby={`group-${group.title}`}
              >
                <h3 id={`group-${group.title}`}>{t(group.title)}</h3>
                <ul>
                  {group.slugs.map((slug) => {
                    const page = documentationPages.find((entry) => entry.slug === slug);
                    if (!page) throw new Error(`Missing home package guide: ${slug}`);
                    const metadata = getPageMetadata(page, locale);
                    return (
                      <li key={slug}>
                        <Link className="home-package" href={getDocumentationPath(slug, locale)}>
                          <div>
                            <span className="home-package-name">
                              {metadata.title}
                              {slug === "ui/index" && (
                                <span className="home-source-label">{t("sourceOnly")}</span>
                              )}
                            </span>
                            <p>{metadata.description}</p>
                          </div>
                          <ArrowUpRight aria-hidden="true" className="home-package-arrow size-4" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className="home-guides" aria-label={t("guides")}>
          <Link className="home-guide" href={getDocumentationPath("architecture/index", locale)}>
            <h2>
              {t("architecture")} <ArrowRight aria-hidden="true" className="size-4" />
            </h2>
            <p>{t("architectureDescription")}</p>
          </Link>
          <Link className="home-guide" href={getDocumentationPath("development/index", locale)}>
            <h2>
              {t("development")} <ArrowRight aria-hidden="true" className="size-4" />
            </h2>
            <p>{t("developmentDescription")}</p>
          </Link>
        </section>

        <footer className="home-footer">
          <span>Raypx Kit</span>
          <a href={getSourceUrl("docs/src/components/home.tsx")} target="_blank" rel="noreferrer">
            {t("source")} <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </a>
        </footer>
      </div>
    </HomeLayout>
  );
}
