# Documentation Site

## Purpose

An English Fumadocs site for Raypx Kit. This internal application does not
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

- Use TanStack Start, Fumadocs and the repository Bun/Vite+/Turbo toolchain.
- Use the official `@fumadocs/base-ui` components and `fumadocs-core` with caret
  ranges that resolve to the same installed version. The root `toolchain:check`
  verifies this pairing. Do not reintroduce the Radix-based `fumadocs-ui` package.
- Use Nitro's `bun` preset for development and `cloudflare_module` for builds.
  Use `bun --bun vp` for development and invoke `vp` directly for build and
  preview so Wrangler runs with Node.
  Node 24.22.0 is the repository consumer-check and npm transport baseline.
- Library tsdown builds belong to their packages. This internal application keeps
  its Vite+ build and does not generate library declarations or archives.
- Read Node from `.nvmrc` and Bun from root `packageManager`; mise only enables
  those sources without `[tools]` versions. Use `mise trust && mise install`,
  shell activation or `mise exec -- <command>`, then `bun run doctor` and
  `bun run toolchain:check` when setting up or changing runtimes.
- Preserve current versus proposed API status, source provenance and all inventory rows.
- Resolve Markdown links against their canonical source during compilation;
  registered pages use site routes and other repository files link to GitHub.
- Use lazy content loading and a search API built from canonical content, with no production database,
  authentication, external search provider or application environment dependency.
- Keep the UI in English and retain localized message examples in their intended languages.
- Respect light/dark themes, keyboard access and reduced-motion preferences.

## Verification

Keep documentation tests in `tests/`. The root `test:toolchain` command runs
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
