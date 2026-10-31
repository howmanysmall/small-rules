`@pobammer-ts/small-rules` is an Oxlint-native lint plugin: general TypeScript rules plus Roblox-specific ones. This repository uses **Turborepo** for cached workspace tasks (`turbo run <task>`). `node_modules/.bin` is on `PATH` through `mise.toml`, so run tools directly (`vitest run`, `biome check`, `tsdown`). Add a `package.json` script or a `mise.toml` task only when it carries something a bare command does not: flags, environment, ordering between steps, or several commands. A wrapper that only renames one command is clutter, so do not add one, and do not route a call through one.

## Workflow

1. Read [`CODING_STANDARDS.md`](CODING_STANDARDS.md) before the first edit under `src/`, `tests/`, `tools/`, `scripts/`, `packages/`, or `documentation/tests/`.
2. Red first: write the failing test, then the change that turns it green. Done when the gates in `CODING_STANDARDS.md` pass.
3. Pre-flight the hooks with `hk run check --safe <changed files>`. Done when every step passes.
4. Commit with `mise run commit '<message>'` (Conventional Commits, signed off). Done when the hooks and the fallow gate below are green.

## Pointers

| Before you... | Read |
|---|---|
| add or change a rule, or find where something lives | [`docs/architecture.md`](docs/architecture.md) |
| copy third-party code into the repo | [`docs/vendoring.md`](docs/vendoring.md) |
| delete, trace, audit, or rank code | [`docs/agents/fallow.md`](docs/agents/fallow.md) |
| release, debug CI, or run the deep tests | [`docs/release.md`](docs/release.md) |
| file, read, or triage an issue | [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md) and [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md) |
| name a domain concept | [`GLOSSARY.md`](GLOSSARY.md); to explore the domain, [`docs/agents/domain.md`](docs/agents/domain.md) |

<!-- fallow:setup-hooks:start -->
`fallow audit` gates every `git commit` and `git push`; the command, its verdict, and the task map are in [`docs/agents/fallow.md`](docs/agents/fallow.md).
<!-- fallow:setup-hooks:end -->
