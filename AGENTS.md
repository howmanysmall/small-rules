`@pobammer-ts/small-rules` is an Oxlint-native lint plugin: general TypeScript rules plus Roblox-specific ones. Scripts run with `nr <script>` and mise tasks with `mise run <task>`; `package.json` and `mise.toml` are the index of commands.

## Workflow

1. Read [`CODING_STANDARDS.md`](CODING_STANDARDS.md) before the first edit under `src/`, `tests/`, `tools/`, `scripts/`, or `packages/`.
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
