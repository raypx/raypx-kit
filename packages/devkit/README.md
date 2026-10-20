# @raypx-kit/devkit

Maintenance checks and task helpers for Bun monorepos: workspace boundaries,
toolchain pins, static message catalogs, documentation links and relocated build
artifacts.

```sh
bun add -d @raypx-kit/devkit
```

ESM only, for Node 22.14+ and Bun. Each entry is independent, so a consumer loads
only the dependencies it uses. The package reads files and spawns processes; it
contains no product rules, so repositories compose their own policy from it.

| Entry            | Purpose                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `./workspaces`   | Discover workspaces, read boundary metadata and resolve imports        |
| `./architecture` | Check dependencies, exports, cycles, platform targets and import leaks |
| `./toolchain`    | Read Node/Bun pins, check every duplicated pin and the active runtimes |
| `./catalogs`     | Read static message catalogs without executing them                    |
| `./docs`         | Report broken relative Markdown links                                  |
| `./process`      | Run commands, load dotenv files and run Turbo with a guarded cache     |
| `./artifact`     | Stage a relocated output and probe a running Node server               |

## Workspace architecture

Repositories can keep their check policy in a typed file and pass plain data to
Devkit. For example, a repository with one `packages/messages` workspace can use
`devkit.config.ts`:

```ts
import type { ToolchainOptions } from "@raypx-kit/devkit/toolchain";
import type { Metadata } from "@raypx-kit/devkit/workspaces";

export default {
  workspaces: {
    "packages/messages": {
      kind: "library",
      target: "universal",
      entryTargets: { "./client": "browser" },
      sourceTargets: { "src/client/**": "browser" },
      sourceEntries: {
        ".": "./src/index.ts",
        "./client": "./src/client.ts",
      },
    },
  } satisfies Record<string, Metadata>,
  toolchain: {
    documents: ["README.md", "AGENTS.md"],
    turboGlobalDependencies: [".nvmrc", "mise.toml", "devkit.config.ts"],
  } satisfies ToolchainOptions,
};
```

The repository's own script imports that trusted configuration explicitly:

```ts
import { checkArchitecture } from "@raypx-kit/devkit/architecture";
import { discover } from "@raypx-kit/devkit/workspaces";
import config from "../devkit.config.js";

const index = discover(root, { metadata: config.workspaces });
const findings = checkArchitecture(index);
```

`metadata` accepts a `Readonly<Record<string, Metadata>>` keyed by discovered
workspace paths relative to `root`, such as `packages/messages`. Keys must match
the discovered paths exactly, without `./` or a trailing slash. The map is the
complete metadata source: missing and unknown workspaces are findings, and
manifest metadata is not merged or used as a fallback. Discovery is synchronous;
it never finds, imports or executes a configuration file. The filename and
loading mechanism belong to the caller.

`kind` is `app`, `library` or `tooling`; targets are `universal`, `browser`,
`native`, `node` and `bun`. Every workspace is ESM; application workspaces must
declare `private: true`, while libraries and tooling can be publishable.

`sourceEntries` maps a public export key to its maintained TypeScript or
JavaScript source. Use it when `exports` points to generated output so the gate
can inspect sources before building. Each mapping must name an existing source
within its workspace and correspond to an actual export. Without a mapping,
the check follows the declared export targets directly. Package-root JSON
configuration exports therefore need no source mapping.

`bundledDependencies` lists external development dependencies deliberately bundled
into the published runtime. Each name must be declared in `devDependencies`, and
the package build must bundle it. This option permits those source imports; it
does not exempt workspace boundaries or platform checks. Ordinary runtime
dependencies and peers remain in their respective manifest fields.

Without an explicit `metadata` map, discovery retains the manifest interface.
Each workspace stores its metadata under `package.json#devkit` by default; a
custom `metadataKey` selects a different field:

```ts
const index = discover(root, { metadataKey: "devkit" });
```

An external map moves checking policy only. Workspace membership, exports and
dependencies still come from package manifests, and aliases come from workspace
TypeScript configurations. Keep a repository's typed policy file in its type
check and build-cache dependencies.

`discover` also reports directories under `apps/` and `packages/` without a
manifest; pass `containers` to change them. `checkArchitecture` statically parses
runtime sources under `src/`, `server/`, `native/` and `app/` and walks every
public source entry. It reports public applications and invalid metadata,
libraries without exports, missing export targets, non-`workspace:*` internal
ranges, dependency cycles including development dependencies, undeclared runtime
or type imports, internal cross-workspace paths, application or tooling imports
from runtime code, test-only imports, host APIs used outside their target and DOM
globals reachable from universal or native entries.

`resolveImport` marks paths that bypass a workspace's public exports with
`internalPath: true`; architecture findings call these internal cross-workspace
imports. Package publication status is separate and uses the standard manifest
`private` field.

This package's own tests live under `tests/`; production entries live under
`src/` and are the only sources included in the library build.

## Toolchain

`.nvmrc` pins Node and the root `packageManager` (`bun@x.y.z`) pins Bun. Every
other declaration must follow those two sources.

```ts
import { assertToolchainRuntime, checkToolchain, pinnedNode } from "@raypx-kit/devkit/toolchain";
import config from "../devkit.config.js";

const findings = checkToolchain(root, config.toolchain);
const { node, bun, nodeBinary } = assertToolchainRuntime(root, {
  nodeBinaryEnv: "DEVKIT_NODE_BINARY",
});
```

`checkToolchain` checks `engines.node` and both `devEngines` entries (including
`onFail: "error"`), rejects `.node-version`, `.bun-version` and `.tool-versions`,
requires `mise.toml` to read the existing pins without `[tools]`, requires every
`actions/setup-node` and `oven-sh/setup-bun` step to read `.nvmrc` and
`package.json` in workflows under `.github/workflows/` and composite actions
under `.github/actions/`, matches the `@types/node` range baseline by major and the
`@types/bun` range baseline to the Bun pin in every manifest and Bun catalog,
and checks Dockerfile `node:` and `oven/bun:` images,
documented `Node x.y.z` and `Bun x.y.z` versions and Turbo global dependencies.
`pinnedNode` returns the Node executable after checking its version; the binary
variable selects an executable but never relaxes the version.

## Catalogs and documentation

```ts
import { readStaticCatalog } from "@raypx-kit/devkit/catalogs";
import { checkDocumentLinks } from "@raypx-kit/devkit/docs";

const en = readStaticCatalog("src/messages/en.ts");
const broken = checkDocumentLinks(root, ["README.md", "docs/guide.md"]);
```

`readStaticCatalog` accepts JSON or a module whose default export is an object
literal of strings, optionally with `as const` or `satisfies`. Computed values,
spreads and computed keys are rejected, and the module is never executed. Pair it
with `compareMessageCatalogs` from `@raypx-kit/intl/testing` for ICU parity.

## Processes and artifacts

```ts
import { pinnedNode } from "@raypx-kit/devkit/toolchain";
import { probeArtifact } from "@raypx-kit/devkit/artifact";
import { developmentEnvironment, run, turbo } from "@raypx-kit/devkit/process";

await turbo(root, "build", ["--filter", "web"], { trustedCacheEnv: "CACHE_TRUSTED" });
await probeArtifact({
  name: "web",
  output: `${root}/apps/web/.output`,
  node: pinnedNode(root),
  check: async (base) => {
    if (!(await fetch(base)).ok) throw new Error("home page failed");
  },
});
```

`developmentEnvironment` copies the process environment and layers `.env.local`
and `.env` beneath it without printing values. `turbo` must run under Bun; it
loads dotenv files for `dev` and `build`, and unless the trusted variable is
`"true"` removes remote cache credentials and uses the local cache only.
`stageArtifact` copies an output after rejecting absolute links and links that
escape it. `probeArtifact` stages the output in a temporary directory, starts its
entry with the given Node on a free port, waits for the health path, runs the
check and always stops the server.
