# Publishing

Publication is always an explicitly authorized maintainer action. Packages are
`0.0.0-alpha.*` prereleases until the first stable release; see the
[Changesets workflow](changesets.md) for how versions advance.

Each public `@raypx-kit/*` package starts at `0.0.0-alpha.0`.

Changesets 3.0.3 has publish tools for npm, pnpm and Yarn Berry only. In a Bun
workspace it packs with npm, which publishes `workspace:` and `catalog:`
dependencies verbatim. The release commands therefore pack each archive with
`bun pm pack`, the packer `pack:check` verifies, and let Changesets plan, publish
and tag those exact archives. Never run plain `changeset publish`.

## One-time setup

1. The GitHub repository is `raypx/raypx-kit`. Create its `npm` environment, adding
   reviewers if desired.
2. Create the npm organization `raypx-kit` and give maintainers publish access to
   the `@raypx-kit` scope. GitHub organization access does not grant npm access.
3. Follow [repository setup](README.md#setup) to select the pinned Bun,
   install dependencies and check the toolchain. Node is only needed here for npm transport (or explicit Cloudflare packaging),
   using the baseline in `scripts/packages/node-version`. Authenticate with `npm login --force` and confirm
   the account with `npm whoami --force`. npm may require a one-time password
   for publication.

Changesets uses npm for registry queries and uploads. The release scripts and CI
scope `NPM_CONFIG_FORCE=true` to registry transport because npm otherwise rejects
the repository's strict Bun `devEngines` declaration. Use `--force` for npm
account commands inside this checkout. Do not set `NPM_CONFIG_WORKSPACES=false`:
npm can infer the current workspace and reject that conflicting configuration.

## Manual alpha release

Run every step on an up-to-date `canary` with a clean working tree.

The release aliases map to the repository CLI:

```sh
bun run raypx-kit-dev release plan
bun run raypx-kit-dev release pack
bun run raypx-kit-dev release publish
```

Use `release:plan`, `release:pack` and `release:publish` for the corresponding
commands below. Place options after the final CLI subcommand, such as
`release pack --stable`.

1. **Version.** Follow the [Changesets workflow](changesets.md) and commit the
   prepared versions, changelogs and lockfile. Skip versioning for a package's
   first publication.
2. **Verify.** Run `bun run verify --full`, the same [complete gate](README.md#daily-commands)
   used by CI, including package builds and isolated archive consumers.
3. **Plan.** `bun run release:plan` is read-only and never replaces a packed
   plan. It lists every version missing from npm with its dist-tag, fails unless
   each is a `@raypx-kit/*` package at an `-alpha.N` version, and reports
   changesets that still need `bun run version-packages`.
4. **Pack.** `bun run release:pack` refuses unreleased changesets, rebuilds
   stale package output through VP and packs each planned package with
   `bun pm pack`. It rejects archives that would still publish `workspace:`,
   `catalog:`, `file:` or `link:` dependencies, then installs and loads those
   exact archives in isolated Bun consumers. CI also requires the independent
   Node compatibility workflow before publication. Only after those checks
   pass does it record the packed commit. Output replaces only
   `.changeset/pack/release/`; inspect an archive with
   `tar -tzf .changeset/pack/release/packages/<archive>.tgz`.
5. **Publish.** `bun run release:publish` refuses a dirty tree, a branch other
   than `canary`, a commit other than the packed one or a changed tarball, then
   publishes exactly the packed tarballs and creates local git tags. Append
   `--otp <code>` directly when npm asks for a one-time password, or set
   `NPM_CONFIG_OTP`. The CLI treats OTP codes as strings and preserves leading
   zeros. Pass additional Changesets arguments after `--`, as in
   `bun run raypx-kit-dev release publish -- <Changesets args>`. This also forwards
   `--help` to Changesets. With the `release:publish` alias and no preceding
   wrapper options, Bun consumes the leading separator; use
   `bun run release:publish -- -- <Changesets args>`.
6. **Push.** Run the `git push origin canary <tags>` command the script prints for
   the tags it found locally, so each tag such as `@raypx-kit/env@0.0.0-alpha.0`
   reaches GitHub.
7. **Confirm.** Check `npm view @raypx-kit/<package> dist-tags` for every package
   against the [pre-mode tag rules](changesets.md#initial-publication-and-pre-mode).
8. **Consume.** In each consuming repository, pin the exact new version, refresh
   the lockfile and run that repository's verification gate.

When every version is already on npm, packing and publication succeed without
publishing anything. Packing and publication stay separate commands: packing
outlasts an npm one-time password, and the archives can be reviewed before upload.

## Consumer previews

Consumers such as Raypx try unreleased changes in two ways, neither of which
versions packages or creates tags.

**Local link.** Build once with `bun run build` (or keep `bun run dev` running in
the package), run `bun link` in `packages/<name>`, then `bun link @raypx-kit/<name>`
in the consumer. This changes only the consumer's `node_modules`; its next
`bun install` restores the registry version. The link resolves to this checkout,
so React consumers must resolve the linked package's external React peer to
the application's instance, for example with Vite's `resolve.dedupe` for
`react` and `react-dom`. Intl's `use-intl` is bundled; a separate installation
cannot share its context. Metro does not follow links outside its watch
folders; preview native apps with a snapshot.

**Snapshot.** On any branch with a clean working tree:

```sh
bun run release:snapshot                 # packages named by unreleased changesets
bun run release:snapshot intl env        # or explicit packages
bun run release:snapshot --publish --otp <code>
```

The command builds, temporarily sets each package version to
`0.0.0-next-<UTC timestamp>-<commit>`, packs with `bun pm pack`, and runs the same
archive and isolated consumer checks as a release. It restores every manifest
before publication, including when packing or consumer checks fail.
Archives stay in `.changeset/pack/snapshot/`. Only `--publish` uploads them, under
the `next` dist-tag, so `latest` and `alpha` never move. Consumers pin the exact
printed version and replace it with
the released alpha before merging. Publishing a snapshot is a maintainer action
like any other publication. Packages that depend on sibling `@raypx-kit/*`
packages are refused, because a snapshot rewrites only its own version.

## CI publication

For npm trusted publishing, first publish each new package manually, then enable
CI publication:

1. On npmjs.com, add a trusted publisher to every package: GitHub Actions,
   repository `raypx/raypx-kit`, workflow `release.yml`, environment `npm`. For a
   registry requiring tokens, set the `NPM_TOKEN` secret instead.
2. Set the repository variable `NPM_PUBLISH_ENABLED` to `true`.

On `canary`, the workflow first calls the independent Node compatibility workflow,
then verifies with Bun and runs `release:ci`, which chains the same
`release:pack` and `release:publish` commands for versions absent from npm,
requesting provenance. The action runs its script without a shell.
Pushes without new versions pass as no-ops. The separate
[version PR setup](changesets.md#automatic-version-prs) does not enable publication.

## First stable release

Leave pre mode only with explicit approval of the stable release:

```sh
bun run changeset pre exit
bun run version-packages   # every package graduates to 0.0.0
git commit -am "chore: release stable packages"
bun run release:pack --stable
bun run release:publish --stable
```

`--stable` is a direct CLI flag, as in
`bun run raypx-kit-dev release pack --stable`; it does not belong after `--`.
Without `--stable`, the release commands refuse to plan, pack or publish after
pre mode ends. Further prereleases require `bun run changeset pre enter <tag>`.

## Recovering from mistakes

- npm never accepts the same name and version twice, even after unpublishing.
  Fix forward with the next prerelease.
- If publication stops partway, run `bun run release:pack` again. The new plan
  contains only versions still missing from npm; then run
  `bun run release:publish`.
- Correct a dist-tag with `npm dist-tag add @raypx-kit/<package>@<version> <tag>`.
  Move `latest` only intentionally.
- `npm unpublish @raypx-kit/<package>@<version>` is limited to npm's unpublish
  window and to versions nothing depends on. Prefer fixing forward.
