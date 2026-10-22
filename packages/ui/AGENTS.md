# @raypx-kit/ui

## Purpose

Publish reusable React 19 primitives using Base UI, shadcn base-nova, Lucide and
Tailwind CSS 4. Product layouts, business logic and application providers belong
to consumers. Neutral tokens and theme behavior belong to `@raypx-kit/themes`.

## Ownership

- `src/components/ui/` contains the explicit primitive inventory in
  `shadcn-components.json`; adapt generated imports to `#components` and `#lib`.
- `src/lib/utils.ts` exposes `cn`. Preserve explicit package exports and published
  declarations; React and React DOM are peers and must never be bundled.
- Root `styles.css` imports theme mappings and animation utilities, and declares
  `@source "./dist"` so consumers scan every published component and shared chunk.
  Consumers import the Tailwind engine once; do not import it again here.
- `components.json` retains the `base-nova` style and Base UI implementation.
  Do not introduce Radix or a second icon library.

Preserve focus behavior, accessible names, controlled and uncontrolled APIs,
reduced motion and the default button type. Keep destructive text on tinted
surfaces using `text-destructive-text`. Track source updates and complete license
texts in `NOTICE.md`; do not replace the pinned adaptation silently.

## Verification

Run `bun run test`, `bun run check`, and `bun run build` in this package, then the
root `bun run verify`. Tests cover interactions and server rendering. The archive
consumer checks explicit subpaths, declarations, SSR and Tailwind stylesheet
resolution against installed tarballs, without source aliases.
