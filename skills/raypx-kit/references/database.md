# @raypx-kit/drizzle and @raypx-kit/drizzle-kit

Both target Drizzle ORM `>=1.0.0-rc.5-5935859 <1.0.0-rc.5-z`, PostgreSQL only, with
the postgres.js driver (`pg`/node-postgres is unsupported).

```sh
bun add @raypx-kit/drizzle 'drizzle-orm@>=1.0.0-rc.5-5935859 <1.0.0-rc.5-z' postgres@^3.4.9
bun add -d @raypx-kit/drizzle-kit
```

## @raypx-kit/drizzle

| Entry          | Exports                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `.`            | `withoutColumns(table, ...names)` for selects                                                          |
| `/postgres`    | `excludedColumns` for UPSERT `set`, JSONB `jsonValue`/`jsonText`/`jsonType`/`jsonNumber`/`jsonBoolean` |
| `/errors`      | `isUniqueViolation(error, constraintName)` (no drizzle needed)                                         |
| `/results`     | `first`, `inserted` (no drizzle needed)                                                                |
| `/diagnostics` | `buildExplain`, `summarizePlan`                                                                        |

JSONB paths are segment arrays (`["settings", "plan.tier"]`), never dot strings.
`buildExplain(statement, { analyze: true })` executes the statement; the default does not.

## @raypx-kit/drizzle-kit

Upstream drizzle-kit's CLI byte for byte, without the programmatic `api-*`/`payload`
bundles (~7 MB instead of ~101 MB). The `drizzle-kit` binary name is unchanged:

```ts
import { defineConfig } from "@raypx-kit/drizzle-kit";
export default defineConfig({ dialect: "postgresql", schema: "./src/schema.ts", out: "./drizzle" });
```

To keep `import "drizzle-kit"`, alias it:
`"drizzle-kit": "npm:@raypx-kit/drizzle-kit@<version>"`.

Full guides: [drizzle](https://github.com/raypx/raypx-kit/blob/canary/packages/drizzle/README.md), [drizzle-kit](https://github.com/raypx/raypx-kit/blob/canary/packages/drizzle-kit/README.md)
