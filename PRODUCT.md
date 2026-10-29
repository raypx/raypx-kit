# Raypx Kit Documentation

This brief defines the documentation site's reading experience. Repository
ownership and package boundaries are documented in the
[architecture guide](docs/architecture/README.md); canonical guides are listed in
the [documentation index](docs/README.md).

## Register

product

## Users

TypeScript developers evaluating and using the independently released Raypx Kit
libraries, and maintainers reviewing their source provenance and release process.
Readers need to find an API, understand its compatibility, and distinguish
available behavior from future extension work.

## Product Purpose

Present the canonical English package guides and complete upstream inventories
through a searchable English/Chinese Fumadocs site. Maintained translations are
optional per page; untranslated bodies show the English source with a clear notice.
Repository Markdown remains the source of truth, and published libraries retain
their own API guides. The site's UI uses the public `@raypx-kit/intl` and
`@raypx-kit/themes` integrations, composed into Fumadocs' layout controls.

## Brand Personality

Precise, practical, transparent. Follow the Fumadocs documentation interface
selected for this project, with familiar navigation and readable technical prose.

## Anti-references

Do not present research inventories as implemented APIs. Avoid duplicated guides,
promotional landing-page copy, decorative motion, and page-wide horizontal scroll.

## Design Principles

- Keep current APIs and future extension designs clearly labeled.
- Preserve complete capability inventories and pinned source references.
- Give every page a direct link to its canonical repository source.
- Make search, navigation and long tables usable on desktop and mobile.

## Accessibility & Inclusion

Use Fumadocs keyboard-accessible navigation and search, visible focus states,
readable light and dark themes, and reduced-motion preferences. The URL selects
the language before rendering; switching languages preserves the current location.
English prose retains localized message examples in their intended languages.
