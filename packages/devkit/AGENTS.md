# @raypx-kit/devkit

## Purpose

Repository maintenance building blocks shared by Raypx Kit and Raypx. Consumers
compose their own policy, CLI and product probes from these entries.

## Interface

| Path             | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `./workspaces`   | Discovery, metadata, export and import resolution           |
| `./architecture` | Workspace boundary checks over static imports               |
| `./toolchain`    | Node/Bun pin reading, declaration checks and runtime checks |
| `./catalogs`     | Static message catalog reader                               |
| `./docs`         | Relative Markdown link check                                |
| `./process`      | Commands, dotenv environment and guarded Turbo runs         |
| `./artifact`     | Relocated output staging and Node server probes             |
| `./lint`         | Plain Vite+ base and opt-in strict lint presets             |
| `./testing`      | Plain Vitest defaults for Bun workers                       |

`./tasks` owns shared task discovery, graph validation, arguments, VP launch/leaf
execution, configuration projection and artifact snapshots. `./verification` owns
Git changes and scope propagation; `./vite` owns injected Start environment loading.
Callers explicitly supply trusted policies. Keep product/native/packaging decisions
in their repositories; never discover or execute inspected configuration files.

The README documents the complete shipped API.

## Constraints

- No product names, package scopes, catalogs, routes or environment variables.
  Product conventions are options; defaults use the `devkit` metadata key and
  `DEVKIT_*` variables.
- Accept repository policy as plain data. Explicit workspace metadata is keyed by
  repository-relative workspace paths and must cover the discovered workspaces
  exactly; do not merge it with manifest metadata. Keep the default `metadataKey`
  interface compatible for consumers that store policy in package manifests.
- Never discover, import or execute a repository configuration file implicitly.
  Raypx Kit's internal scripts import root `devkit.config.ts` explicitly; that
  filename and repository-specific policy do not belong in this package's runtime.
- Never execute inspected sources or catalogs; parse them with oxc-parser.
- Never print loaded environment values or secrets.
- Use Node APIs only. Task execution receives an explicit Bun executable; planning
  and configuration remain loadable on supported Node versions.
- Toolchain checks default to Node/Bun; explicit `runtime: "bun"` forbids Node
  pins without requiring a Node executable. Keep existing defaults compatible.
- Lint/test entries export plain objects with no runtime Vite+ imports. Consumers
  own paths, suites, setup, app plugins and native configuration composition.
- Do not import other Raypx Kit packages. Keep entries independent so each loads
  only its own dependencies.
- Allow internal bundled runtime imports only for app/tooling workspaces with both
  explicit `bundledDependencies` metadata and a development dependency declaration.
  Preserve export, platform, application, tooling and dependency cycle constraints.
- Keep findings as stable `path: message` strings; consumers and tests match them.
- Raypx Kit's own maintenance scripts import this package's source directly.
- Keep package tests under `tests/`; `src/` contains production code only.
  Consumer architecture-scanning rules describe consumer layouts and must not
  change to match this package's own test layout.

## Verification

```bash
bun run --cwd packages/devkit test
bun run --cwd packages/devkit check
bun run build --filter=@raypx-kit/devkit
bun run --cwd packages/devkit pack:check
```
