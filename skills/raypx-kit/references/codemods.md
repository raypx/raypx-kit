# @raypx-kit/codemods

```sh
bun add -d @raypx-kit/codemods
raypx-kit-codemod list
```

No built-in migrations are registered yet. `runCodemod(migration, files, { write })`
runs a custom `Codemod` over explicit files; dry-run is the default and every
transform finishes before the first write.

Full guide: [README](https://github.com/raypx/raypx-kit/blob/canary/packages/codemods/README.md)
