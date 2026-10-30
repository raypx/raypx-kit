import defaultMdxComponents from "@fumadocs/base-ui/mdx";
import { File, Files, Folder } from "@fumadocs/base-ui/components/files";
import { Step, Steps } from "@fumadocs/base-ui/components/steps";
import { Tab, Tabs } from "@fumadocs/base-ui/components/tabs";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";
import { useLocale, useTranslations } from "../lib/i18n/client";
import { localizeDocumentationUrl } from "../lib/i18n/config";

const MdxLink = defaultMdxComponents.a;

function LocalizedLink({ href, ...props }: ComponentProps<"a">) {
  const locale = useLocale();
  return (
    <MdxLink
      {...props}
      {...(href === undefined ? {} : { href: localizeDocumentationUrl(href, locale) })}
    />
  );
}

function ScrollableTable(props: ComponentProps<"table">) {
  const t = useTranslations("page");
  return (
    <div className="docs-table-scroll" role="region" aria-label={t("table")} tabIndex={0}>
      <table {...props} />
    </div>
  );
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    File,
    Files,
    Folder,
    Step,
    Steps,
    Tab,
    Tabs,
    a: LocalizedLink,
    table: ScrollableTable,
    ...components,
  } satisfies MDXComponents;
}

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
