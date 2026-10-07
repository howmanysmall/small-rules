# Architecture

Where things live and the convention each location carries. `src/` is the plugin, `tests/` mirrors it, and `tools/` and `packages/` hold the workspace packages both of them import.

## Entry Point - `src/index.ts`

`definePlugin` from `oxlint-plugin-utilities` registers every rule under its kebab-case name. Each rule is imported from `$oxc-rules/<category>/<rule-name>`, and the plugin is the default export.

## Rules - `src/rules/<category>/<rule-name>.ts`

One rule per file. Every rule is built with `createRule(name, category, rule)` from `$oxc-utilities/create-rule`, which wraps an `oxlint-plugin-utilities` `CreateRule` or `CreateOnceRule` and injects `meta.docs.url`; the option type is inferred from `meta.schema`.

`createBannedGlobalCallRule({ name, alternative, category, message, messageId, ruleName })` from `src/utilities/banned-global-call-rule.ts` builds the simple global-call bans such as `no-print` and `no-warn`.

## Utilities - `src/utilities/`

ESTree node guards (`isCallExpression`, `isIdentifierNamed`, `isStringLiteral`, ...) come from the workspace package `@small-rules/oxlint-utilities` in `packages/oxlint-utilities`. `src/utilities/` holds the rule-specific helpers, and its directory listing is the index. Three files carry conventions: `create-rule.ts` (the rule factory), `banned-global-call-rule.ts` (global-call bans), and `oxc-utilities.ts` (repo-specific node predicates built on the shared guards).

## Types - `src/types/`

Ambient declarations only: a module augmentation for `oxlint-plugin-utilities` and shims for untyped packages.

## TypeScript Layout

The `$oxc-*` and `$test/*` path aliases are defined in the `paths` block of `tsconfig.base.json`.

`tsconfig.json` is a solution file over `tsconfig.lib.json`, `tsconfig.test.json`, and `tsconfig.node.json`. Project references are derived from each `package.json`, and a missing one is silent: `tsgo --build` resolves the import through the root `node_modules` and skips the project. `nr references:check` catches it and `nr references:sync` repairs it.

## Tests - `tests/`

Tests mirror `src/`: `tests/rules/<category>/<rule>.test.ts` (one per rule), `tests/utilities/` (shared helpers), `tests/tooling/` (release, vendoring, and repo scripts), `tests/documentation/`, `tests/rule-relations/`, `tests/properties/` (fast-check rule properties), and `tests/fuzz/*.fuzz.ts`. `tests/index.test.ts` covers plugin metadata, and `tests/fixtures/` holds on-disk fixture projects. The rule harness is the workspace package `@small-rules/rule-harness` in `tools/rule-harness`; how to write a rule test is in [`CODING_STANDARDS.md`](../CODING_STANDARDS.md).

## Quality Thresholds

- `vitest.config.ts` - 100% v8 coverage threshold; type checking through `tsgo`
- `stryker.config.mjs` - mutates `src/` except `.d.ts` files, `src/types/`, generated code, and `index.ts`; breaks below 70%
