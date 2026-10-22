# @raypx-kit/env

```sh
bun add @raypx-kit/env zod@^4.6.7
```

Zod is a required peer so your schemas and the package share one Zod runtime.

## createEnv

```ts
import { createEnv, z } from "@raypx-kit/env";
import { runtimeEnv } from "@raypx-kit/env/runtime";

export const env = createEnv({
  extends: [runtimeEnv], // NODE_ENV: development | production | test
  shared: { APP_NAME: z.string().default("Example") },
  server: { PORT: z.coerce.number().int().positive().default(3000) },
  client: { VITE_API_ORIGIN: z.url() },
});
```

- Reads `process.env` and Vite's `import.meta.env`; explicit `runtimeEnv` wins.
- Public keys must start with `VITE_`; server keys must not.
- In the browser (`window` exists and Vite's `SSR` flag is false) server schemas are not
  validated and reading a server key throws `EnvError`. Override with `isServer`.

## defineEnv

Validates only the supplied `runtimeEnv` (falls back to `process.env`), never
merges `import.meta.env`, and accepts a custom `clientPrefix` such as `PUBLIC_`.

## Presets and options

Presets (`{ id, extends, shared, server, client, clientPrefix }`) compose in order;
later presets and the environment's own schemas override earlier keys. Blank strings
become `undefined`. Options: `runtimeEnv`, `isServer`, `skip`, `transform`,
`onError` (must throw), `onInvalidAccess` (must throw). `env._schema` exposes the
final schema.

The library loads no `.env` files. Access guards do not remove secrets you have
already embedded in a browser bundle.

Full guide: [README](https://github.com/raypx/raypx-kit/blob/canary/packages/env/README.md)
