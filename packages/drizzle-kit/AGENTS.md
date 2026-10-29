# @raypx-kit/drizzle-kit

## Purpose

Redistributes drizzle-kit's CLI bundle and `defineConfig` without the unused
prebuilt API and payload bundles.

## Interface

| Path          | Purpose                                      |
| ------------- | -------------------------------------------- |
| `.`           | Upstream `defineConfig` and its declarations |
| `drizzle-kit` | Upstream CLI binary (`dist/bin.cjs`)         |

## Constraints

- `bun run build` copies upstream files from the lockfile's resolved `drizzle-kit`
  devDependency into `dist/`. Never edit or rebundle them.
- Generate `dist/package.json` with `type: commonjs` so upstream `.js` and
  `.d.ts` files retain their module semantics; `.mjs` and `.d.mts` remain ESM.
- Preserve upstream runtime dependency names and existing ranges. Widen exact
  upstream versions to caret ranges that include those versions; tests check the
  dependency names and that upstream ranges remain subsets of our declarations.
  Review these declarations with each upstream upgrade.
- esbuild also supports `^0.28.2` alongside upstream's `^0.25.10`. Keep the archive
  consumer's real TypeScript migration-generation check under both Bun and Node
  when changing this dependency; loading exports or CLI help does not compile schemas.
- Stable dependencies and coverage providers use caret ranges. Installed coverage
  providers must match Vite+'s bundled Vitest version.
- The `drizzle-kit` and `drizzle-orm` devDependencies and the isolated archive
  consumer's `drizzle-orm` use `>=1.0.0-rc.5-5935859 <1.0.0-rc.5-z`.
  Validate the lockfile's selected RC5 builds together; the CLI loads the
  application-provided ORM.
- Keep tests under `tests/`, schema fixtures under `tests/fixtures/schema/` and
  isolated archive consumer fixtures under `tests/fixtures/consumer/`.
  Production extraction code stays under `src/`.
- To upgrade: review both development ranges and the consumer fixture, refresh
  upstream dependency ranges, update the README's built-version table, add a
  changeset and run the tests against the resolved builds.

## Verification

```bash
bun run --cwd packages/drizzle-kit test
bun run --cwd packages/drizzle-kit check
bun run build --filter=@raypx-kit/drizzle-kit
bun run --cwd packages/drizzle-kit pack:check
```
