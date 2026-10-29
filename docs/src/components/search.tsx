import { useFetchSearch } from "fumadocs-core/search/client";
import { useLocale, useTranslations } from "../lib/i18n/client";
import { documentationPages, getDocumentationPath, getPageMetadata } from "../lib/pages";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SearchItemType,
  type SharedProps,
} from "@fumadocs/base-ui/components/dialog/search";

function EmptySearchResults() {
  const t = useTranslations("search");
  return (
    <p role="status" className="px-4 py-10 text-center text-sm text-fd-muted-foreground">
      {t("empty")}
    </p>
  );
}

export default function DocsSearchDialog(props: SharedProps) {
  const locale = useLocale();
  const t = useTranslations("search");
  const search = useFetchSearch({ api: "/api/search", locale });
  const defaultItems: SearchItemType[] = documentationPages
    .filter((page) => ["index", "drizzle/index", "intl/index"].includes(page.slug))
    .map((page) => ({
      type: "page",
      id: page.slug,
      content: getPageMetadata(page, locale).title,
      url: getDocumentationPath(page.slug, locale),
    }));

  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent className="docs-search">
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput aria-label={t("label")} />
          <SearchDialogClose />
        </SearchDialogHeader>
        {search.error ? (
          <p role="alert" className="px-4 py-10 text-center text-sm text-fd-muted-foreground">
            {t("error")}
          </p>
        ) : (
          <SearchDialogList defaultItems={defaultItems} Empty={() => <EmptySearchResults />} />
        )}
        <SearchDialogFooter>
          <p role="status" aria-live="polite" className="text-xs text-fd-muted-foreground">
            {search.isLoading ? t("loading") : t("hint")}
          </p>
          <p className="mt-2 text-xs text-fd-muted-foreground">{t("shortcuts")}</p>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
