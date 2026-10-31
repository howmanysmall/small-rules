# CI, Release, and Deep Tests

## CI Pipeline

`.github/workflows/ci.yaml` runs on push/PR to main (path-filtered) and calls the reusable `checks.yaml`, which runs three jobs:

- **Validate** - Biome, oxfmt for MDX, lint, type-check, fallow dead-code, fallow dupes, and the minified build
- **Documentation** - docs type-check, build, React unit tests, and Chromium browser tests
- **Test** - Vitest plus the stored fuzz regression corpus

Type-check, build, tests, and the docs jobs run through `turbo run`. Each job restores its own `.turbo/cache` with `actions/cache`, and `--affected` limits a run to tasks whose inputs changed since `TURBO_SCM_BASE` (the pull request's base, or the commit before a push). `nr check` runs the cached lint, type-check, test, and build locally.

`mise run check` runs the same validation locally (lint, type-check, dead-code, duplicates, build, test); `mise run ci` installs dependencies first and adds the documentation job.

## Coverage

Vitest enforces 100% coverage and fails the Test job below it, so Codecov only reports. The Test job uploads `coverage/coverage-final.json` and `coverage-summary.json` as a `coverage` artifact. A separate `coverage` job in `ci.yaml` downloads it and sends it to Codecov with OIDC (`use_oidc`), so there is no upload token to rotate.

- `id-token: write` sits on that job alone, because the Test job runs pull request code.
- Pull requests from forks skip the job: they cannot mint an OIDC token. A failed upload fails CI only on pushes to main.
- `--affected` can skip every test, which leaves no artifact. The job then uploads nothing, and the `unit` flag carries forward the last report (`codecov.yaml`).
- `//#test` declares `coverage/**` as a Turborepo output, so a cache hit restores the report instead of leaving `coverage/` empty.

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
