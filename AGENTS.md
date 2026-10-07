# Agents Guide

`@pobammer-ts/small-rules` is an Oxlint-native lint plugin: general TypeScript rules plus Roblox-specific ones (React Luau components, Ianitor life cycle, `useReducer` patterns, Roblox UI element conventions).

## Coding Standards

Before changing any file under `src/`, `tests/`, `tools/`, `scripts/`, or `packages/`, read [`CODING_STANDARDS.md`](CODING_STANDARDS.md). It holds the hard gates (no casts, tests first, 100% coverage, the three `:agent` commands that must pass), the hot-path conventions pointer, the rule test conventions, the docs-manifest rule, and the vendoring procedure.

## Commands

Scripts live in `package.json` and run via `nr <script>` (`@antfu/ni`); longer workflows are mise tasks in `mise.toml` (`mise run <task>`). Beyond the gates in `CODING_STANDARDS.md`:

| Command | What it does |
|---------|-------------|
| `nr build` | Bundle to `dist/index.js` via `tsdown` |
| `nr format` | Format with `biome check --fix` + `oxfmt` |
| `nr fallow:dead-code` | Detect unused files, exports, types, dependencies |
| `nr fallow:dupes` | Detect duplicated and structurally-similar code |
| `nr fallow:audit` | Gate the current changeset before a commit or PR |
| `nr fallow:health` | Rank complexity hotspots and refactoring targets |
| `nr test:mutation` | Run Stryker mutation testing (break threshold 70%) |
| `nr test:fuzz` | Replay the stored vitiate fuzz corpus |
| `nr test:fuzz:run` | Fuzz for 10 seconds with vitiate |
| `nr release-notes:regenerate` | Interactively regenerate committed release notes with the `communique.toml` model |

## Code Architecture

### Entry Point - `src/index.ts`

`definePlugin` from `oxlint-plugin-utilities` registers every rule under its kebab-case name. Each rule is imported from `$oxc-rules/<category>/<rule-name>`, and the plugin is the default export.

### Rules - `src/rules/<category>/<rule-name>.ts`

One rule per file. Every rule is built with `createRule(name, category, rule)` from `$oxc-utilities/create-rule`, which wraps an `oxlint-plugin-utilities` `CreateRule` or `CreateOnceRule` and injects `meta.docs.url`. `create(context)` returns a `Visitor` keyed by AST node type; `context` carries `report()`, `options`, and `sourceCode`. `meta` holds `docs.description`, `messages` (`messageId` → template string), `schema` (the option type is inferred from it), `type` (`"problem"` or `"suggestion"`), and `fixable` for auto-fixable rules.

`createBannedGlobalCallRule({ name, alternative, category, message, messageId, ruleName })` from `src/utilities/banned-global-call-rule.ts` builds the simple global-call bans such as `no-print` and `no-warn`.

### Utilities - `src/utilities/`

ESTree node guards (`isCallExpression`, `isIdentifierNamed`, `isStringLiteral`, ...) come from the workspace package `@small-rules/oxlint-utilities` in `packages/oxlint-utilities`. `src/utilities/` holds the rule-specific helpers, and its directory listing is the index. Three files carry conventions: `create-rule.ts` (the rule factory), `banned-global-call-rule.ts` (global-call bans), and `oxc-utilities.ts` (repo-specific node predicates built on the shared guards).

### Types - `src/types/`

Ambient declarations only: a module augmentation for `oxlint-plugin-utilities` and shims for untyped packages.

Path aliases from `tsconfig.base.json`: `$oxc-rules/*` → `src/rules/*`, `$oxc-utilities/*` → `src/utilities/*`, `$oxc-types/*` → `src/types/*`, `$oxc-generated/*` → `src/generated/*`, `$test/*` → `tests/*`.

## Testing

Tests mirror `src/`: `tests/rules/<category>/<rule>.test.ts` (one per rule), `tests/utilities/` (shared helpers), `tests/tooling/` (release, vendoring, and repo scripts), `tests/documentation/`, `tests/rule-relations/`, `tests/properties/` (fast-check rule properties), and `tests/fuzz/*.fuzz.ts`. `tests/index.test.ts` covers plugin metadata, and `tests/fixtures/` holds on-disk fixture projects. The rule harness is the workspace package `@small-rules/rule-harness` in `tools/rule-harness`; how to write a rule test is in `CODING_STANDARDS.md`.

## Key Configuration Files

- `tsconfig.base.json` - shared strict compiler policy and path aliases; `tsconfig.json` references the library, test, and Node tooling projects (`tsconfig.lib.json`, `tsconfig.test.json`, `tsconfig.node.json`)
- `biome.jsonc` - linting + formatting (tabs, 120 width, double quotes)
- `fallow.toml` - fallow entry points, ignores, rule severities, duplication thresholds, and the audit gate
- `mise.toml` - tool versions and tasks (`ci`, `check`, `release`)
- `pnpm-workspace.yaml` - package manager config (catalogs, trust policy, resolution mode)
- `stryker.config.mjs` - mutation testing; mutates `src/` except types, generated code, and `index.ts`
- `vitest.config.ts` - test config (100% v8 coverage threshold, `tsgo` typechecker)
- `hk.pkl` - git hook steps
- `codebook.toml` - custom dictionary with Roblox-specific terms

## CI Pipeline

`.github/workflows/ci.yaml` runs on push/PR to main (path-filtered) and calls the reusable `checks.yaml`, which runs three jobs:

- **Validate** - Biome, oxfmt for MDX, lint, type-check, fallow dead-code, fallow dupes, and the minified build
- **Documentation** - docs type-check, build, React unit tests, and Chromium browser tests
- **Test** - Vitest plus the stored fuzz regression corpus

`.github/workflows/deep-tests.yaml` runs weekly and on demand: property tests at `PROPERTY_RUNS=10000`, real fuzzing (`test:fuzz:run`), and Stryker mutation testing.

`.github/workflows/release.yaml` runs on `v*.*.*` tags or manually with `dry_run`. It does not re-run CI: it waits for the matching main-branch CI run for the tag SHA, then publishes via NPM Trusted Publishing (OIDC). `communique` generates the release notes, with `git-cliff` as the fallback.

## Release Flow

1. `mise run release` runs the local `check` task, then `nr release` (`bumpp` bumps the version, commits, tags, and pushes).
2. The tag push triggers `release.yaml`, which waits for the existing successful CI run for that commit.
3. `mise run dr` triggers a dry run on GitHub Actions instead.

## Git Hooks

`hk` owns the git hooks, configured in `hk.pkl`: pre-commit runs the file checks (type-check, lint, format, markdown lint) on the staged files, and pre-push runs the full gates (type-check, tests, build, fallow audit). To run the pre-commit steps on specific files first: `hk run check --safe <files>`.

## Agent Skills

- **Issue tracker**: GitHub Issues on `howmanysmall/small-rules`; see `docs/agents/issue-tracker.md`.
- **Triage labels**: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`; see `docs/agents/triage-labels.md`.
- **Domain docs**: single-context, one root `CONTEXT.md` plus `docs/adr/`; see `docs/agents/domain.md`.

---

<!-- fallow:setup-hooks:start -->
## Fallow Local Gate

Before any `git commit` or `git push`, run `fallow audit --format json --quiet --explain --gate-marker agent`. If the verdict is `fail`, fix the reported findings before retrying. Treat JSON runtime errors like `{ "error": true, ... }` as non-blocking.

The audit gates on `new-only`: only findings introduced by the current changeset affect the verdict. Inherited findings on touched files are reported under `attribution` with `introduced: false` and do not block.

## Fallow Task Map

| When the agent is about to... | Run |
|---|---|
| delete an "unused" export or file | `fallow dead-code --trace <file>:<export>` |
| prove a TypeScript symbol's exact consumers before refactoring | `fallow dead-code --type-aware --symbol-impact <file>:<export-or-class.method>` |
| find how one module reaches another | `fallow trace --path <from> <to>` |
| delete an "unused" dependency | `fallow dead-code --trace-dependency <name>` |
| commit or open a PR | `fallow audit --base <ref>` |
| read a diff before approving it | `fallow review --base <ref> --brief` (orientation only, never gates) |
| prioritize refactoring | `fallow health --hotspots --targets` |
| ask who owns code | `fallow health --ownership` |
| check untested-but-reachable code | `fallow health --coverage-gaps` |
| consolidate duplication | `fallow dupes --trace dup:<fingerprint>` |
| find feature flags | `fallow flags` |
| check which architecture rules apply to a file before changing it | `fallow guard <files>` |
| surface security candidates | `fallow security` |
| understand a finding | `fallow explain <issue-type>` |
| scope a monorepo | `--workspace <glob> / --changed-workspaces <ref>` (global flags, prefix any command) |

<!-- fallow:setup-hooks:end -->
