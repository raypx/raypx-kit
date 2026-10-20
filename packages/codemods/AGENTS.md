# Codemods

## Scope

Own the reusable source migration runner and the `raypx-kit-codemod` CLI.
The initial package has no built-in migrations. Add a migration only for a real
API or configuration transition, with its own input/output and repeat-run tests.
Do not add placeholder transformations or import application migration policy.

## Contracts

- The root entry is side-effect free. Only `src/cli.ts` executes the command;
  CLI parsing lives in `src/internal/cli.ts` and accepts a registry for tests.
- Register built-in migrations in `src/migrations/index.ts`. Keep that registry
  internal; applications can pass a `Codemod` directly to `runCodemod`.
- Run only explicit UTF-8 files, resolve and deduplicate their paths, and reject
  directories and symlink files. Do not add glob discovery or arbitrary config
  loading without a concrete migration need.
- Dry-run is the default. Prepare every transform before writing any file.
  Null, undefined and identical text leave files untouched. Never log source
  content. Write failures can leave earlier writes applied; this is not a
  transactional filesystem API.
- Tests belong in `tests/`; `tests/fixtures/consumer` checks the real archive's
  public declarations, runner and CLI with both Bun and Node.

Keep this scaffold dependency-free. Choose a parser only when a concrete
migration needs syntax-aware rewriting; preserve comments and directives and
test the syntax it supports.
