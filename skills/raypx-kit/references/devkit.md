# @raypx-kit/devkit

```sh
bun add -d @raypx-kit/devkit
```

Building blocks for a repository's own policy script. Each entry is independent.

| Entry           | Purpose                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| `/workspaces`   | `discover(root, { metadata })` workspaces and boundary metadata             |
| `/architecture` | `checkArchitecture(index)`: dependencies, exports, cycles, platform targets |
| `/toolchain`    | Node/Bun pins and duplicated version mentions                               |
| `/catalogs`     | Read static message catalogs without executing them                         |
| `/docs`         | Report broken relative Markdown links                                       |
| `/process`      | Run commands, load dotenv files, run Turbo with a guarded cache             |
| `/artifact`     | Stage relocated outputs and probe a running Node server                     |

Metadata per workspace: `kind` (`app` | `library` | `tooling`), `target`
(`universal` | `browser` | `native` | `node` | `bun`), optional `entryTargets`,
`sourceTargets` and `sourceEntries`. Keep it in a typed file you import explicitly;
discovery never loads configuration on its own. Findings are plain strings for your
script to print and fail on.

Full guide: [README](https://github.com/raypx/raypx-kit/blob/canary/packages/devkit/README.md)
