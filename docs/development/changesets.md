# Changesets

Every public package owns its version and changelog. `fixed` and `linked` are
empty: changing one package never forces unrelated packages to share its version.
Dependency compatibility can still require a dependent package to receive a bump.

`canary` is the development and release branch, configured as Changesets'
`baseBranch`. Its name does not select an npm dist-tag. Normal prereleases use
the pre-mode state below; consumer snapshots use `next`.

## Initial publication and pre mode

The repository is in pre mode with the `alpha` tag, recorded in
`.changeset/pre.json`. New packages start at `0.0.0-alpha.0`, with initial work
recorded in their initial changelog. Publish that manifest version after
verification without running `bun run version-packages` first: versioning consumes
changesets and advances versions.

In pre mode, versioning produces the next `alpha.N` prerelease for changed
packages only. Until a package has a stable release, `latest` follows its newest
prerelease: npm assigns `latest` at first publication, and the release scripts
publish later prereleases there too. Changesets alone would stop doing so once npm's
staged publishing leaves its `0.0.0-stage` placeholder version, so `release:pack`
derives the dist-tag from the published versions (`scripts/release/tags.ts`).
After the first stable release, prereleases use only `alpha`. Consumers pin exact prerelease versions.

Exiting the current pre mode graduates every package to stable `0.0.0`. Do this
only for an explicitly approved first stable release, following the
[stable publication procedure](publishing.md#first-stable-release).
`bun run release:check` tests independent version bumps, private-package exclusion
and pre-mode graduation in disposable local repositories; it does not publish or
exercise npm's dist-tag behavior.

## Preparing subsequent versions

1. For a user-visible change after initial publication, run `bun run changeset`,
   select the affected packages, choose a SemVer bump and describe the resulting
   behavior. Commit the Markdown file with the implementation. Use
   `bun run changeset --empty` for a no-release marker only when a release reviewer
   requests one.
2. Merge to `canary`. Prepare versions through a version PR or run
   `bun run version-packages` locally. That command consumes changesets, updates
   versions and changelogs, refreshes `bun.lock` and README license indexes, and
   formats the result.
3. Review and commit the resulting versions, changelogs and lockfile. A local
   version commit pushed to `canary` is valid; a version PR is optional.
4. Follow the [publishing runbook](publishing.md) to verify, pack and publish the
   committed versions. Preparing versions does not publish them.

Dependency updates follow the [dependency policy](dependencies.md). Each package
gets a Git tag containing its manifest version, such as
`@raypx-kit/env@0.0.0-alpha.0`; the current version always comes from its manifest.

## Automatic version PRs

The release workflow on `canary` selects whether versions or publication are
pending. Automatic version PRs are disabled unless the repository variable
`VERSION_PR_ENABLED` is exactly `true`.

To enable them, allow **GitHub Actions to create and approve pull requests** under
**Settings → Actions → General → Workflow permissions**, then set that variable.
The workflow's `pull-requests: write` permission cannot override repository or
organization policy. When enabled, `changesets/action/version` runs
`bun run version-packages` to open or update the version PR. Otherwise the workflow
reports pending version changes and skips PR creation.

Review the PR and run CI before merging. Version PRs created with the default
GitHub token do not trigger another PR workflow automatically; run CI manually
against the PR branch, or configure a GitHub App token for the version action.
Publication has its own `NPM_PUBLISH_ENABLED` switch and authentication setup;
enabling version PRs does not enable publication.
