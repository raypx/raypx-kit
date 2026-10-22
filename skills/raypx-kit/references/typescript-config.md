# @raypx-kit/tsconfig

```sh
bun add -d @raypx-kit/tsconfig typescript
```

| Preset                                   | For                                        |
| ---------------------------------------- | ------------------------------------------ |
| `@raypx-kit/tsconfig/node.json`          | Node/Bun code (`NodeNext`, `@types/node`)  |
| `@raypx-kit/tsconfig/browser.json`       | Browser apps (`Bundler`, DOM, `react-jsx`) |
| `@raypx-kit/tsconfig/library.json`       | ESM libraries (`Bundler`, no DOM)          |
| `@raypx-kit/tsconfig/react-library.json` | React libraries                            |

All presets are strict, including `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes` (use `...(value ? { value } : {})`) and
`verbatimModuleSyntax` (`import type`). They set `noEmit`; projects own
`include`, `paths`, `outDir` and ambient types such as Bun or Vite client types.

Full guide: [README](https://github.com/raypx/raypx-kit/blob/canary/packages/tsconfig/README.md)
