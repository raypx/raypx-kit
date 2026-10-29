# Documentation Site

## Purpose

A bilingual English/Chinese Fumadocs site for Raypx Kit. This internal application does not
publish to npm or change the independent versions of the libraries.

## Interface

`/docs` contains the documentation map, architecture, package guides, design
references and maintainer documentation. `architecture/README.md` owns repository
boundaries and build/content flow. `development/README.md` owns setup and checks;
dependency maintenance, versioning and publishing have focused sibling guides.
Package READMEs own shipped APIs, and `drizzle/` inventories and plans retain
their research status. Search is generated from the same content and operates
without a third-party service.

## Ownership

- Render the canonical root and package Markdown through Fumadocs.
- Keep navigation, table of contents, source links, search and theme controls usable.
- Compile canonical Markdown directly through Fumadocs; keep page routes and
  navigation in `src/lib/pages.ts`. Do not commit generated build artifacts.
- Keep the root README as a concise repository entry point; do not mirror it as
  a development page. Preserve existing site routes when reorganizing source files.
  Register new canonical pages in both the page list and navigation, and include
  their source files in `src/lib/source.ts`.
- Keep all library source, package versions and npm payloads outside this app.

## Constraints

- Use TanStack Start, Fumadocs and the repository Bun/Vite+ toolchain.
- Use the official `@fumadocs/base-ui` components and `fumadocs-core` with caret
  ranges that resolve to the same installed version. The root `toolchain:check`
  verifies this pairing. Do not reintroduce the Radix-based `fumadocs-ui` package.
- Use Nitro's `bun` target for normal builds and previews. `build:cloudflare`
  explicitly selects the Worker target and isolated Node vendor tooling; keep the
  deployment build working through the separate compatibility workflow.
  All commands use VP; application plugins belong in `vite.app.config.ts`.
- Root `packageManager` is the single Bun development pin. mise enables Bun only.
  Run doctor and toolchain checks after runtime/configuration changes.
- Preserve current versus proposed API status, source provenance and all inventory rows.
- Resolve Markdown links against their canonical source during compilation;
  registered pages use site routes and other repository files link to GitHub.
- Use lazy content loading and a search API built from canonical content, with no production database,
  authentication, external search provider or application environment dependency.
- Consume `@raypx-kit/intl` through public exports for the controlled provider and
  typed UI catalogs. URL locales own SSR and hydration; never restore a different
  browser preference after rendering a language-specific URL.
- Preserve English routes at `/docs` and Chinese routes at `/zh/docs`. Language
  changes retain the page, query and hash. Fumadocs owns locale-aware trees and
  search; preserve the locale in canonical Markdown links at render time.
- English Markdown remains canonical. Register maintained Chinese translations in
  `src/lib/i18n/pages.ts` and compile them from `content/zh/`. Missing translations
  use the English body with an explicit localized notice and body `lang`.
- Source type checks map consumed public Intl/Themes entries to their maintained sources;
  Vite builds and browser tests resolve the built public exports. The VP docs development task builds
  workspace dependencies before starting the server.
- `@raypx-kit/themes` owns theme state, first-paint initialization and persistence.
  Keep `ThemeScript` before styles, share `src/lib/theme.ts` with the provider,
  and retain the legacy `theme` storage key. Disable Fumadocs' default theme provider
  and place the app's accessible three-choice control in `slots.themeSwitch`.
  Mount the D shortcut once above both sidebars and ignore typing or open dialogs.
- Keep prerendering at two concurrent pages and preview on IPv4 loopback so
  building documentation does not multiply the workspace test budget or depend on localhost DNS.
- Keep English/Chinese UI catalogs complete and ICU-compatible. Localize Fumadocs
  controls, search states and accessibility labels through the application catalog.
  An `Empty` search renderer must return JSX instead of invoking hooks conditionally.
- Respect light/dark themes, keyboard access and reduced-motion preferences.

## Verification

Keep documentation unit tests in `tests/`. The root `test:toolchain` command runs
these tests through the shared Vitest configuration.
The root `knip` command checks this workspace's source files, dependencies and
internal exports. Treat framework routes and dynamically loaded content as
entry-point boundaries; any exception must be narrowly scoped and explained.
The existing root `verify` command runs Knip in CI alongside the other checks.

```sh
bun run test:toolchain
bun run docs:check
bun run docs:build
bun run knip
bun run verify
```

Use `bun run docs:dev` for development at `http://localhost:3100`.

Browser scenarios live in `e2e/` and run through `bun run test:e2e`. They use
the built Bun application through the shared local preview wrapper,
with Playwright Chromium and the root shared E2E runner. Keep browser cases out
of the unit runner; root verification includes their separate post-build gate.
