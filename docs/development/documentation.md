---
steps: true
---

# Writing documentation

The site compiles canonical Markdown with Fumadocs. Use its built-in plugins for
file trees, callouts, steps and code tabs; the same source stays readable in the
repository. Keep package READMEs focused on their published APIs.

## Formatting and tables

Run `bun run format` from the repository root. The Markdown/MDX overrides in
[vite.config.ts](../../vite.config.ts) use a 100-column width, two-space indentation,
LF line endings and a final newline. They preserve authored prose line breaks and
format supported code examples automatically. Oxfmt handles table column alignment
and spacing through the same command; the repository's `vp check` gate checks this
formatting in CI.

Use plain text for table values, including paths, package names and API names.
Keep Markdown links where readers need to navigate. Oxfmt preserves inline-code
delimiters, so writing table values without backticks is an authoring convention;
the formatter does not remove them automatically.

## File trees

Use a `files` fence with one root and indentation or tree connectors. End directory
names with `/`, including empty directories. Fumadocs renders folders expanded by
default; readers can collapse them with the mouse or keyboard.

````md
```files
example/
├── src/
│   └── index.ts
└── package.json
```
````

```files
example/
├── src/
│   └── index.ts
└── package.json
```

Keep file names in the tree and explain responsibilities in prose or tables, as in
the [repository architecture](../architecture/README.md#repository-shape).

## Callouts

Use a directive with an optional title. Supported types are `note`, `tip`, `info`,
`warn`, `warning`, `danger` and `success`. Markdown links, lists and code work
inside a callout.

```md
:::tip[Keep one source of truth]
Edit the canonical guide, then run the documentation checks.
:::
```

:::tip[Keep one source of truth]
Edit the canonical guide, then run the [documentation checks](README.md#documentation-site).
:::

## Steps

Add `steps: true` to the page's YAML frontmatter to enable Fumadocs' `remarkSteps`
plugin. Mark consecutive headings of the same level with `[step]`, or number them
as `### 1. Select a source`. A normal heading at that level ends the sequence.
Pages without this flag keep numbered headings as ordinary sections, including
the research inventories and their existing anchors.

```md
---
steps: true
---

### Select a source [step]

Edit the canonical Markdown.

### Register the page [step]

Add its metadata and navigation entry.
```

### Select a source [step]

Edit the existing canonical guide. New maintainer guides belong in `docs/development/`;
maintained translations belong in `docs/content/zh/`.

### Register the page [step]

Add new pages and navigation entries to [pages.ts](../src/lib/pages.ts), include
their source patterns in [source.ts](../src/lib/source.ts), and supply Chinese
navigation metadata in [the translation map](../src/lib/i18n/pages.ts).

### Verify the result [step]

Run `bun run docs:check`, `bun run docs:build` and `bun run test:e2e --project docs`.
Check the rendered page in both themes and at a mobile width.

## Code tabs

Fumadocs' default preset groups adjacent code fences with `tab` labels. Add a
`title` to display a filename or command context. Syntax highlighting, line
highlighting and copy controls also come from the default preset.

````md
```sh tab="Development" title="Repository root"
bun run docs:dev
```

```sh tab="Build" title="Repository root"
bun run docs:build
```
````

```sh tab="Development" title="Repository root"
bun run docs:dev
```

```sh tab="Build" title="Repository root"
bun run docs:build
```

## Package manager tabs

For consumer installation examples, a fence with the `npm` language generates
equivalent npm, pnpm, Yarn and Bun commands automatically. Repository maintenance
commands continue to use the pinned Bun runtime.

````md
```npm
npm install zod
```
````

```npm
npm install zod
```

## Plugin configuration

[vite.app.config.ts](../vite.app.config.ts) extends Fumadocs' default preset with
`remarkMdxFiles`, `remarkDirective` plus `remarkDirectiveAdmonition`, and the
page-level `remarkSteps` opt-in. It retains the default code-tab, npm-tab, GFM,
heading, search and code-highlighting plugins. [mdx.tsx](../src/components/mdx.tsx)
registers the official Base UI file, step and tab components alongside the default
callout and code-block components.

See the official [file tree](https://fumadocs.dev/docs/headless/mdx/remark-mdx-files),
[admonition](https://fumadocs.dev/docs/headless/mdx/remark-admonition),
[steps](https://fumadocs.dev/docs/headless/mdx/remark-steps) and
[MDX preset](https://fumadocs.dev/docs/mdx/mdx) documentation for syntax and options.
