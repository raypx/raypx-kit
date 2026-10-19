# @raypx-kit/intl

## Purpose

Configurable locale negotiation, typed ICU translation, native formatting and a
controlled React facade without product dependencies.

## Interface

```text
@raypx-kit/intl         createLocaleRuntime, formatter, translator, presets and types
@raypx-kit/intl/client  createIntlClient<Messages>()(runtime, defaults), controlled IntlProvider,
                      LanguageProvider and hooks
@raypx-kit/intl/browser createBrowserLanguage and browser preference/cookie adapters
@raypx-kit/intl/server  createIntlServer and synchronous translator
@raypx-kit/intl/types   type-only public contracts
@raypx-kit/intl/testing catalog shape, ICU arguments/tags and syntax checks
```

## Ownership

- Applications own locale choices, catalogs, loading and request snapshots. The
  optional LanguageProvider stays controlled; /browser adapters take storage keys,
  legacy keys and catalogs from the application. Never hard-code Raypx keys,
  catalogs, framework loaders or product error codes here.
- Browser adapters touch DOM globals only inside functions and effects, tolerate
  blocked storage and cookies, and keep server and first client renders equal.
- Locale runtimes copy/freeze supported locales. `system` is reserved;
  parsePreference accepts exact supported values, and resolvePreference tries
  every system candidate in order through the same lookup matcher.
- `use-intl` 4.14.9 owns compilation, Intl caches, React context and native
  hooks. Use public entrypoints, never upstream private contexts/cache APIs.
  It and its FormatJS dependencies are dev dependencies bundled by `deps.onlyBundle`.
  Keep the third-party section of `LICENSE` in sync with every bundled package and version.
  React 19 is the only peer and remains required for every entry, including root/server.
- Use caret ranges for stable development dependencies, including the coverage
  provider. Its installed version must match Vite+'s bundled Vitest; record actual
  locked versions in the third-party license list. Preserve use-intl's own compatible
  dependency ranges instead of overriding its transitive major versions.
- Client factories bind types/static defaults only. The provider requires
  locale and the current full catalog or null. No provider-owned locale state,
  loaders, storage, callbacks or context isolation. Hooks read nearest provider.
- Preserve readonly catalog keys while widening translated string leaves.
  Preserve upstream namespace/key/ICU value inference and an explicit dynamic
  mode; do not install a product-wide AppConfig augmentation from this library.
- Core formatter takes an object and returns upstream methods unchanged.
  Relative time is date-based. Keep UTC/quiet fallback/presets in one pure
  configuration boundary; custom definitions replace individual presets.
- Server headers use structural HeaderReader, never the DOM Headers global.
  Optional request hints stay undefined when no supported preference exists.
- Catalog tooling compares keys/node shape, syntax, argument and tag names;
  plural categories, ordering and tag nesting may vary. Parse errors identify
  only the failing side. Keep parser dependencies isolated in /testing.

## Verification

Run package check/test/build, then repository verify. Type assertions belong in
`tests/`; public packed-consumer fixtures live in `tests/fixtures/consumer` and
are executed by the repository pack check. Core tests run in Node, and client
tests in `tests/client/` run in jsdom with the repository's
`tests/setup/jsdom-preload.ts` preload. Keep the public `src/testing.ts` library
entry under `src/`. Do not publish or change alpha mode without user authorization.
Preserve independent versioning and include a breaking changeset.
