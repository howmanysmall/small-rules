# Agents Guide

This file provides guidance to agents when working with code in this repository.

## What Is This?

An Oxlint-native lint plugin (`@pobammer-ts/small-rules`) providing many custom rules for TypeScript projects. The rules target both general and Roblox-specific patterns: React Luau components, Ianitor life cycle, `useReducer` patterns, Roblox UI element conventions, and general TypeScript quality.

## Rules

You **MUST** follow these guidelines. There is NO exception.

- You are NEVER to cast. This codebase is strongly typed. The `defineRule` function can infer options without manual type annotations. Do NOT do it.
- You MUST use `nr lint:agent [files...]` to run the linter. There is no exception to failing lint checks.
- You MUST use `nr test:agent` to run Vitest unit tests. There is no exception to failing tests.
- You MUST use `nr type-check:agent` to run type checking. There is no exception to failing type checks.
- You MUST always use TDD.

## Commands

| Command | What it does |
|---------|-------------|
| `aube install` | Install dependencies (Aube is the package manager, not `pnpm`/`bun`) |
| `nr build` | Bundle to `dist/index.js` via `tsdown` |
| `nr test:agent` | Run all Vitest unit tests |
| `nr test:agent -- tests/no-print.test.ts` | Run a single test file |
| `nr test:agent -t "no-print"` | Run tests matching a pattern |
| `nr lint:agent` | Run oxlint then biome check |
| `nr type-check:agent` | Run `tsgo` for type checking |
| `nr format` | Format with `biome check --fix` + `oxfmt` |
| `nr format:check` | Check formatting without modifying |
| `nr knip` | Detect unused files, exports, dependencies |
| `nr test:mutation` | Run Stryker mutation testing (thresholds: break at 70%) |
| `nr test:fuzz` | Run vitiate regression from stored corpus |
| `nr test:fuzz:run` | Run vitiate fuzz testing (10 second default) |
| `mise run check` | Full local validation: lint → type-check → `knip` → build → test |
| `mise run ci` | install + check |
| `mise run release` | bump, tag, push via `bumpp` (interactive, asks confirmation) |

Run commands via `nr <script>` (provided by `@antfu/ni`). Mise tasks are defined in `mise.toml`.

## Code Architecture

### Entry Point - `src/index.ts`

Uses `definePlugin` from `oxlint-plugin-utilities` to register all 87 rules. Each rule is imported from `$oxc-rules/<rule-name>` and mapped by kebab-case key. Rules are exported as a default export.

### Rules - `src/rules/*.ts`

Each file is a single rule. Rules are created with:

- **`defineRule()`** - standard oxlint rule factory from `oxlint-plugin-utilities`. Receives `context` (with `report()`, `options`, `sourceCode`) and returns a `Visitor` object keyed by AST node type.
- **`createBannedGlobalCallRule()`** - convenience factory for banning global function calls (e.g. `print()`, `error()`, `warn()`). Takes `name`, `message`, `alternative`, `messageId`.
- **Meta** includes: `docs.description`, `messages` (map of `messageId` → template string), `schema` (JSON Schema for options), `type` ("problem" | "suggestion"), `fixable` (optional, for auto-fixable rules).
- Path alias `$oxc-rules/*` → `src/rules/*`

### Utilities - `src/utilities/*.ts`

Shared helpers used across rules:

- `banned-global-call-rule.ts` - Factory for simple global call bans
- `oxc-utilities.ts` - ESTree node type guards (`isCallExpression`, `isIdentifierNamed`, `isStringLiteral`, etc.)
- `ast-utilities.ts` - AST traversal helpers (e.g. `getMemberPropertyName`)
- `component-utilities.ts` - React component detection
- `react-utilities.ts`, `react-hook-utilities.ts`, `react-memo-utilities.ts` - React-specific analysis
- `jest-utilities.ts` - Jest/Vitest matcher and assertion pattern detection
- `directive-comments.ts` - ESLint-style directive comment parsing
- `expression-safety.ts` - Side-effect-free expression checking
- `casing-utilities.ts` - Case convention checks
- `static-expression-utilities.ts` - Constant expression evaluation
- `local-component-discovery.ts` - Finding locally-defined React components
- `recognizers/` - Pattern detectors for code style analysis (`camelCase`, keywords, code footprints)
- `prevent-abbreviations/` - Abbreviation detection and rule logic
- Path alias `$oxc-utilities/*` → `src/utilities/*`

### Types - `src/types/*.ts`

Shared type definitions, reexports from `oxlint-plugin-utilities`, and missing ESTree type workarounds.

- Path alias `$oxc-types/*` → `src/types/*`

## Testing

Tests live in `tests/*.test.ts`, one per rule plus `index.test.ts` for plugin metadata.

Tests use ESLint's `RuleTester` (not a Vitest-native runner). Preconfigured instances in `tests/rule-testers.ts`:

- `js` - plain JavaScript
- `jsx` - JSX
- `ts` - TypeScript (using `@typescript-eslint/parser`)
- `tsx` - TypeScript + JSX

Test pattern:

```ts
import { describe } from "vitest";
import rule from "$oxc-rules/no-print";
import { js } from "./rule-testers";

describe("no-print", () => {
  // @ts-expect-error -- Shut up
  js.run("no-print", rule, {
    invalid: [
      { code: "print('Hello');", errors: [{ messageId: "noPrint" }] },
    ],
    valid: ["Log.info('Hello');"],
  });
});
```

`invalid` cases specify code strings with expected `messageId` (or multiple). `valid` cases are just code strings that should not trigger.

## Key Config Files

- `tsconfig.base.json` - Strict TS config, `module: "preserve"`, `verbatimModuleSyntax`, `bundler` resolution
- `tsconfig.json` - Extends base, adds path aliases (`$oxc-rules/*`, `$oxc-utilities/*`, `$oxc-types/*`, `$small-rules`)
- `biome.jsonc` - Linting + formatting (tabs, 120 width, double quotes)
- `mise.toml` - Tool versions and task definitions (ci, check, release)
- `aube-workspace.yaml` - Package manager config (patches, trust policy, resolution mode)
- `stryker.config.mjs` - Mutation testing config, mutates `src/` excluding types/index
- `vitest.config.ts` - Test config (forks pool, 30s timeout, coverage via v8, tsgo typechecker)
- `codebook.toml` - Custom dictionary with Roblox-specific terms

## CI Pipeline

`.github/workflows/ci.yaml` runs on push/PR to main (filtered to src/tests/scripts/patches paths). Jobs: install → biome → lint (oxlint) → type-check (`tsgo`) → knip → test (`vitest run`).

`.github/workflows/release.yaml` - Triggered by `v*.*.*` tags or manually with dry_run. Validates lint, type-check, knip, build, test, then publishes to NPM via Trusted Publishing (OIDC) and creates a GitHub release via `changelogithub`.

## Release Flow

1. `mise run release` - runs local check, then `nr release` (`bumpp` bumps version, commits, tags, pushes)
2. Push triggers tag → `release.yaml` workflows
3. Or `mise run dr` to trigger a dry run on GitHub Actions for validation
