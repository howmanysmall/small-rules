# CI, Release, and Deep Tests

## CI Pipeline

`.github/workflows/ci.yaml` runs on push/PR to main (path-filtered) and calls the reusable `checks.yaml`, which runs three jobs:

- **Validate** - Biome, oxfmt for MDX, lint, type-check, fallow dead-code, fallow dupes, and the minified build
- **Documentation** - docs type-check, build, React unit tests, and Chromium browser tests
- **Test** - Vitest plus the stored fuzz regression corpus

`mise run check` runs the same validation locally (lint, type-check, dead-code, duplicates, build, test); `mise run ci` installs dependencies first and adds the documentation job.

## Deep Tests

`.github/workflows/deep-tests.yaml` runs weekly and on demand, because each suite is too slow for every pull request:

- Property tests at `PROPERTY_RUNS=10000`; pull requests run the default count.
- Real fuzzing with `nr test:fuzz:run` (10 seconds with vitiate). `nr test:fuzz` replays the stored corpus and runs in every CI Test job.
- Mutation testing with `nr test:mutation` (Stryker; thresholds in `stryker.config.mjs`).

## Release Flow

1. `mise run release` runs the local `check` task, then `nr release` (`bumpp` bumps the version, commits, tags, and pushes). Run it from an up-to-date `main`.
2. The tag push triggers `.github/workflows/release.yaml`. It does not re-run CI: it waits for the matching main-branch CI run for the tag SHA, then publishes via NPM Trusted Publishing (OIDC). The real publish build is `prepublishOnly`.
3. `communique` generates the documentation and GitHub Release notes, with `git-cliff` as the fallback. `nr release-notes:regenerate` interactively regenerates committed release notes with the `communique.toml` model.

To validate the release workflow without publishing, `mise run dr` triggers it on `main` with `dry_run=true`; `mise run release-status` lists recent runs.
