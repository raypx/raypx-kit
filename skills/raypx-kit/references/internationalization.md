# @raypx-kit/intl

```sh
bun add @raypx-kit/intl react@^19.3.1
```

`use-intl` is bundled. Import every translation/formatting API from this package;
installing `use-intl` or `next-intl` alongside creates a second React context.

## Locale runtime

```ts
import { createLocaleRuntime } from "@raypx-kit/intl";

export const localeRuntime = createLocaleRuntime({
  locales: ["en", "zh"] as const,
  defaultLocale: "en",
  cookieName: "site_locale",
});
localeRuntime.resolvePreference(localeRuntime.parsePreference(stored), navigator.languages);
```

`system` is a reserved preference meaning "follow device languages".
`resolveLocale` / `createIntlServer(runtime).resolveRequestLocale(headers)` combine
the cookie and weighted `Accept-Language` on the server.

## React

```tsx
import { createIntlClient } from "@raypx-kit/intl/client";
import type { CatalogShape } from "@raypx-kit/intl/types";

const en = { home: { greeting: "Hi {name}" } } as const;
const zh = { home: { greeting: "你好，{name}" } } satisfies CatalogShape<typeof en>;

export const { IntlProvider, LanguageProvider, useTranslations, useLanguagePreference } =
  createIntlClient<typeof en>()(localeRuntime, { timeZone: "UTC" });
```

- `IntlProvider` is controlled: pass `locale` and the current `messages`.
- `LanguageProvider` resolves the locale from `preference` + `systemLocales` and
  reports choices through `onPreferenceChange`; the app stores them.
- `@raypx-kit/intl/browser` `createBrowserLanguage` adds localStorage + cookie
  persistence with hydration-safe initial snapshots.
- Keys, namespaces and ICU arguments are type-checked against the base catalog.

## Outside React and in tests

`createTranslator` and `createFormatter` work anywhere. `translateErrorCode` maps
an RPC error `code` to a translation key safely. In tests, use
`assertMessageCatalogParity(en, zh, "en", "zh")` from `@raypx-kit/intl/testing`.

Full guide (including migration from older APIs): [README](https://github.com/raypx/raypx-kit/blob/canary/packages/intl/README.md)
