# Agents Guide

`@pobammer-ts/small-rules` is an Oxlint-native lint plugin: general TypeScript rules plus Roblox-specific ones (React Luau components, Ianitor life cycle, `useReducer` patterns, Roblox UI element conventions).

## Workflow

Every task runs these steps in order.

1. **Read [`CODING_STANDARDS.md`](CODING_STANDARDS.md)** before the first edit under `src/`, `tests/`, `tools/`, `scripts/`, or `packages/`. It holds the hard gates: no casts, tests first, 100% coverage, and the three `:agent` commands every change must pass.
2. **Write the failing test, then the change.** Done when the three `:agent` gates in `CODING_STANDARDS.md` pass on every file you touched.
3. **Pre-flight the hooks** with `hk run check --safe <changed files>`. `hk` owns the git hooks (`hk.pkl`): pre-commit runs the file checks on the staged files, pre-push runs type-check, tests, build, and the fallow audit. Done when hk reports every step passed.
4. **Commit with `mise run commit '<message>'`**, which adds the sign-off trailer. The commit-msg hook runs commitlint; `commitlint.config.ts` is the source of truth for the Conventional Commits types and the 72-character header. Done when the commit lands with the hooks green and the Fallow Local Gate (below) passed.

Scripts live in `package.json` and run with `nr <script>` (`@antfu/ni`); longer workflows are mise tasks in `mise.toml` and run with `mise run <task>`. Those two files are the index of commands.

## When You Are About To

| ...do this | read |
|---|---|
| add or change a rule, or find where something lives | [`docs/architecture.md`](docs/architecture.md) |
| copy third-party code into the repo | [`docs/vendoring.md`](docs/vendoring.md) |
| delete "unused" code, trace a dependency, audit a diff, or rank refactoring targets | [`docs/agents/fallow.md`](docs/agents/fallow.md) |
| release, debug CI, or run the deep tests (mutation, fuzz, property runs) | [`docs/release.md`](docs/release.md) |
| file, read, or triage an issue | [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md) and [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md) |
| name a domain concept | [`CONTEXT.md`](CONTEXT.md); to explore the domain, [`docs/agents/domain.md`](docs/agents/domain.md) |

<!-- fallow:setup-hooks:start -->
## Fallow Local Gate

Before any `git commit` or `git push`, the changeset must pass `fallow audit`. The command, how to read its verdict, and what the gate counts are in [`docs/agents/fallow.md`](docs/agents/fallow.md); in Claude Code, `.claude/hooks/fallow-gate.sh` runs it for you.
<!-- fallow:setup-hooks:end -->
