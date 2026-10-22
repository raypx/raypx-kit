# Themes

Own reusable Neutral tokens, pure config/script helpers, and React theme state.
Keep the package independent of applications, pickers, icons, and product code.
Root is the React 19 entry; `/config` and `/script` must work without React or DOM
globals. Preserve SSR snapshots, storage/cookie fallback, media subscriptions,
nonce support, and safe serialization of all inline-script data.

Edit `src/tokens.ts`, then run `generate:theme`; never manually edit the generated
root CSS files. `styles.css` contains tokens only; `tailwind.css` imports those
tokens and maps Tailwind 4 utilities without importing its engine or app resets.
Keep complete source provenance and the Apache 2.0 license in the archive.

Run package check, tests, and build, then installed archive consumers under Bun
and Node including the consumer without optional React peers.
