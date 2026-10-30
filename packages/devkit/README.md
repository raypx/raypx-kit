# @raypx-kit/devkit

Maintenance checks and task helpers for Bun monorepos: workspace boundaries,
toolchain pins, static message catalogs, documentation links and relocated build
artifacts.
The package also exports plain Vite+ lint presets and Bun test defaults.

```sh
bun add -d @raypx-kit/devkit
```

ESM only, for Node 22.21+ and Bun. Each entry is independent, so a consumer loads
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
| `./lint`         | Base and opt-in strict Vite+ lint presets without repository paths     |
| `./testing`      | Plain Vitest defaults for Bun workers                                  |

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

`bundledDependencies` lists development dependencies deliberately bundled into
runtime by the package build. Each name must also be declared in
`devDependencies`. Internal workspace bundles are allowed only for apps and
tooling. Public export boundaries, platform compatibility, application and
tooling restrictions, and dependency cycle checks still apply. Ordinary runtime
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

### Bun-only repositories

The default policy still requires Node and Bun. Repositories that run JavaScript
only with Bun can select that policy explicitly:

```ts
import { assertBunRuntime, checkToolchain, readBunPin } from "@raypx-kit/devkit/toolchain";

const findings = checkToolchain(root, { runtime: "bun", documents: ["README.md"] });
const version = readBunPin(root);
const { bun } = assertBunRuntime(root);
```

This mode reads only `package.json#packageManager`. It checks `devEngines`, Bun
types, mise, Dockerfiles, GitHub workflows/composite actions and selected docs.
It rejects Node engine declarations, Node version files, Node setup actions and
Node runtime images. Node API types remain allowed without a Node runtime pin.
`readBunPin` and `assertBunRuntime` never read `.nvmrc` or execute Node.

### Lint and test presets

With Vite+ 1.3 or later, import the independent configuration entries. They contain
plain data and do not load Vite+, application plugins, test setup or repository
configuration. Their declarations do not require Vite+ in unrelated consumers.

```ts
// vite.config.ts
import { defineConfig } from "vite-plus";
import { strictLint } from "@raypx-kit/devkit/lint";

export default defineConfig({
  lint: {
    ...strictLint,
    ignorePatterns: ["**/dist/**", "**/*.gen.ts"],
    rules: { ...strictLint.rules, "react/no-danger": "off" },
  },
});
```

`baseLint` provides type-aware checking and the Vite+ import rule. `strictLint`
adds TypeScript, React, accessibility, promise and import correctness checks;
adopt it explicitly because stricter rules can introduce findings. Neither
preset chooses generated files, workspace paths or project exceptions.
Consumers own formatting and staged Git commands as well.

```ts
// vitest.config.ts
import { defineConfig, mergeConfig } from "vite-plus/test/config";
import { bunTestDefaults } from "@raypx-kit/devkit/testing";

export default mergeConfig(
  bunTestDefaults,
  defineConfig({
    test: { include: ["tests/**/*.test.ts"], setupFiles: ["./tests/setup.ts"] },
  }),
);
```

`bunTestDefaults` selects the Node environment, one worker, Bun's `--no-env-file`
and `--no-install` flags, and V8 coverage with text/JSON/LCOV reporters. Execute
tests with `bun --bun vp test --run`; install the matching coverage provider when
requesting coverage. Suites, DOM environments, setup files, React deduplication
and application fixtures remain consumer-owned. Use native `mergeConfig` for
overrides; no configuration factory or custom option schema is required.

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

## VP tasks and incremental verification

`@raypx-kit/devkit/tasks` supplies `createTaskModel`, `taskConfig`, `taskRef`,
`taskPlan`, `runTasks`, `runTaskLeaf` and `taskCacheSnapshot`. Explicit policies
supply commands, prerequisites, cache definitions and root tasks; the shared model
reads workspace manifests and never imports an inspected repository's config.
Policies can extend members with native or packaging metadata. Task references
retain `package#task:name`; VP remains the only scheduler and cache executor.

`runTasks` receives an explicit Bun executable, prepares declared output folders
and forwards arguments only to the selected leaf through task-specific environment
keys. Set `allowFilteredArguments` only for wrappers that already support filtered
argument forwarding. Planning and configuration also load on supported Node versions.
`taskCacheSnapshot(directory, previous)` returns sorted artifact identities and a
`changed` flag; cache database rewrites alone do not count as successful artifacts.

`@raypx-kit/devkit/verification` supplies `changedFiles` and `affectedWorkspaces`.
Git paths are NUL-delimited; an unavailable base returns reasons requiring full
coverage. An explicit, monotonic scope policy merges and propagates changes through
workspace dependencies. Repositories retain file classification and gate selection.

`@raypx-kit/devkit/vite` exports `startEnvironment(plugins, loadEnv)`. Pass Start's
plugins and Vite's loader explicitly: it retains dotenv keys, inherited environment
precedence and `VITE_` values without tracking every inherited CI identifier.
A changed upstream plugin name fails with a review diagnostic. No Vite runtime
import or mandatory Vite peer is introduced by these entries.
