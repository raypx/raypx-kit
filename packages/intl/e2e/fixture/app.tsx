import { createLocaleRuntime } from "@raypx-kit/intl";
import { createBrowserLanguage } from "@raypx-kit/intl/browser";
import { createIntlClient } from "@raypx-kit/intl/client";
import type { CatalogShape } from "@raypx-kit/intl/types";
import { useState } from "react";

const runtime = createLocaleRuntime({
  locales: ["en", "de"] as const,
  defaultLocale: "en",
  cookieName: "intl_e2e_locale",
});
const en = {
  title: "Language settings",
  greeting: "Hello {name}",
  items: "{count, plural, one {# item} other {# items}}",
  rich: "Welcome <strong>{name}</strong>",
} as const;
const de = {
  title: "Spracheinstellungen",
  greeting: "Hallo {name}",
  items: "{count, plural, one {# Artikel} other {# Artikel}}",
  rich: "Willkommen <strong>{name}</strong>",
} satisfies CatalogShape<typeof en>;
const client = createIntlClient<typeof en>()(runtime, { timeZone: "UTC" });
const { BrowserLanguageProvider } = createBrowserLanguage(client, runtime, {
  messages: { en, de },
  storageKey: "intl_e2e_preference",
});

function LanguageControls() {
  const { preference, setPreference, hydrated } = client.useLanguagePreference();
  const locale = client.useLocale();
  const t = client.useTranslations();
  const [count, setCount] = useState(1);
  return (
    <section aria-label="Browser language">
      <h1>{t("title")}</h1>
      <p data-testid="locale">{locale}</p>
      <p data-testid="preference">{preference}</p>
      <p data-testid="hydrated">{String(hydrated)}</p>
      <p data-testid="greeting">{t("greeting", { name: "Ada" })}</p>
      <p data-testid="items">{t("items", { count })}</p>
      <p data-testid="rich">
        {t.rich("rich", { name: "Ada", strong: (children) => <strong>{children}</strong> })}
      </p>
      <button onClick={() => setPreference("en")}>English</button>
      <button onClick={() => setPreference("de")}>German</button>
      <button onClick={() => setPreference("system")}>System language</button>
      <button onClick={() => setCount((value) => value + 1)}>Add item</button>
    </section>
  );
}

function ControlledMessage() {
  const t = client.useTranslations();
  return <p data-testid="controlled-greeting">{t("greeting", { name: "Grace" })}</p>;
}

function ControlledLanguage() {
  const [locale, setLocale] = useState<"en" | "de">("en");
  return (
    <section aria-label="Controlled language">
      <client.IntlProvider locale={locale} messages={locale === "en" ? en : de}>
        <ControlledMessage />
      </client.IntlProvider>
      <button onClick={() => setLocale((value) => (value === "en" ? "de" : "en"))}>
        Switch controlled language
      </button>
    </section>
  );
}

export function App() {
  return (
    <BrowserLanguageProvider initialPreference="system" initialSystemLocales={["en-US"]}>
      <main>
        <LanguageControls />
        <ControlledLanguage />
      </main>
    </BrowserLanguageProvider>
  );
}
