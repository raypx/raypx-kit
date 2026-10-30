# @raypx-kit/drizzle-kit

[drizzle-kit](https://orm.drizzle.team/docs/kit-overview)'s command line and
`defineConfig`, without the prebuilt programmatic API and payload bundles that
make up most of the upstream package. Installed size drops from about 101 MB to
about 7 MB; the runtime dependency names are preserved.
The distribution supports Node 22.21+ and Bun.

```sh
bun add -d @raypx-kit/drizzle-kit 'drizzle-orm@>=1.0.0-rc.5-5935859 <1.0.0-rc.5-z'
```

The copied files are upstream's, byte for byte. A generated `dist/package.json`
preserves their CommonJS module type; `.mjs` exports remain ESM. Each artifact is
built from the lockfile's resolved drizzle-kit version. Install `drizzle-orm`
from the supported RC5 range, which the CLI loads from the consumer project.

Drizzle ORM/CLI declarations use `>=1.0.0-rc.5-5935859 <1.0.0-rc.5-z`;
validation tests the builds selected by `bun.lock`. Runtime dependencies preserve
upstream's existing ranges and widen exact upstream declarations to caret ranges
that include the upstream versions. Tests check the dependency names and range
coverage when updating the CLI.

The esbuild dependency also accepts `^0.28.2` alongside upstream's `^0.25.10`.
Archive consumers verify TypeScript config and schema compilation by generating
migrations with the installed CLI under both Bun and Node.

| @raypx-kit/drizzle-kit | drizzle-kit        |
| ---------------------- | ------------------ |
| 0.0.0-alpha.0          | 1.0.0-rc.5-5935859 |

## Usage

The binary keeps its name, so scripts do not change:

```sh
drizzle-kit generate --config drizzle.config.ts
```

Import `defineConfig` from this package:

```ts
import { defineConfig } from "@raypx-kit/drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
});
```

To keep `import "drizzle-kit"` unchanged, install under that name with an alias
instead: `"drizzle-kit": "npm:@raypx-kit/drizzle-kit@0.0.0-alpha.0"`.

## What is omitted

Every CLI command (`generate`, `migrate`, `push`, `pull`, `check`, `up`,
`export`, `studio`, `skills`, `mcp`) ships in the CLI bundle, with the agent
skills it serves. The `drizzle-kit/api-*` and `drizzle-kit/payload/*` entries are
not included; use upstream drizzle-kit for programmatic migrations.

## Development

Tests live under `tests/`. Schema-generation fixtures are in
`tests/fixtures/schema/`, and isolated archive consumer fixtures are in
`tests/fixtures/consumer/`. The build runs the production extractor under `src/`.

## License

MIT, as declared by upstream drizzle-kit. See [LICENSE](LICENSE).
