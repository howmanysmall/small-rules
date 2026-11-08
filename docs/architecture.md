# Architecture

Where things live and the convention each location carries. `src/` is the plugin, and `tools/` and `packages/` hold the workspace packages it imports. Every package keeps its tests next to its source.

## Entry Point - `src/index.ts`

`definePlugin` from `oxlint-plugin-utilities` registers every rule under its kebab-case name. Each rule is imported from `$oxc-rules/<category>/<rule-name>`, and the plugin is the default export.

## Rules - `src/rules/<category>/<rule-name>.ts`

One rule per file. Every rule is built with `createRule(name, category, rule)` from `$oxc-utilities/create-rule`, which wraps an `oxlint-plugin-utilities` `CreateRule` or `CreateOnceRule` and injects `meta.docs.url`; the option type is inferred from `meta.schema`.

`createBannedGlobalCallRule({ name, alternative, category, message, messageId, ruleName })` from `src/utilities/banned-global-call-rule.ts` builds the simple global-call bans such as `no-print` and `no-warn`.

`turbo gen rule` scaffolds a rule: the source, its test, and its docs page, registered in `src/index.ts` and `documentation/src/data/rule-manifest.ts`. `turbo gen package` and `turbo gen opencode-plugin` scaffold the other workspaces. The generators live in `turbo/generators/`.

## Tasks - `turbo.json`

Turborepo runs and caches `build`, `type-check`, `test`, `lint`, and the docs tasks across every workspace. The root package's tasks are root tasks (`//#build`), so their `inputs` exclude what each one never reads; `documentation/turbo.json` adds root `src/`, which the docs import through `$small-rules`. Every task reruns when the root manifest, the lockfile, or an internal package the root depends on changes. `turbo run <task> --force` skips the cache.

## Utilities - `src/utilities/`

ESTree node guards (`isCallExpression`, `isIdentifierNamed`, `isStringLiteral`, ...) come from the workspace package `@small-rules/oxlint-utilities` in `packages/oxlint-utilities`. `src/utilities/` holds the rule-specific helpers, and its directory listing is the index. Three files carry conventions: `create-rule.ts` (the rule factory), `banned-global-call-rule.ts` (global-call bans), and `oxc-utilities.ts` (repo-specific node predicates built on the shared guards).

## Types - `src/types/`

Ambient declarations only: a module augmentation for `oxlint-plugin-utilities` and shims for untyped packages.

## TypeScript Layout

`tsconfig.base.json` holds compiler options only. Each project declares the path aliases it uses in its own `tsconfig.json`, and an alias into another project names that project and goes through a project reference:

| Project | Aliases | References |
|---|---|---|
| `src/` | `$oxc-generated/*`, `$oxc-rules/*`, `$oxc-utilities/*`, `$small-rules` | |
| `tests/` | `$oxc-rules/*`, `$oxc-utilities/*`, `$small-rules` | `src` |
| `scripts/` | `$script-*/*`, `$documentation/*`, `$oxc-generated/*`, `$small-rules` | `src` |
| `documentation/` | `$classes/*`, `$components/*`, `$data/*`, `$utilities/*`, `$small-rules` | `src` |

`src/tsconfig.json` is the only composite project; `src/tsconfig.build.json` narrows it to shipped files for `tsdown`. Vite and Bun resolve the same aliases from the nearest `tsconfig.json` (`resolve.tsconfigPaths`).

`tsconfig.json` is a solution file over `src/`, `tests/`, `scripts/`, `tsconfig.node.json` (root config files), and the workspace packages. Project references are derived from each `package.json`, and a missing one is silent: `tsrs --build` resolves the import through the root `node_modules` and skips the project. `nr references:check` catches it and `nr references:sync` repairs it.

## Tests

A test sits beside the file it covers as `<name>.test.ts`: `src/rules/<category>/<rule>.test.ts` (one per rule), `src/utilities/`, `src/index.test.ts` (plugin metadata), `scripts/utilities/` (generators, vendoring, and `rule-relations/`), and `documentation/tests/unit/` (docs site). The root `tests/` holds only what belongs to no single file: `tests/properties/` (fast-check rule properties), `tests/fuzz/*.fuzz.ts`, `tests/workflows/` (GitHub workflow checks), and `tests/fixtures/` (on-disk fixture projects). The rule harness is the workspace package `@small-rules/rule-harness` in `tools/rule-harness`; how to write a rule test is in [`CODING_STANDARDS.md`](../CODING_STANDARDS.md).

## Quality Thresholds

- `vitest.config.ts` - 100% v8 coverage threshold; type checking through `tsrs`
- `stryker.config.mjs` - mutates `src/` except `.d.ts` files, `src/types/`, generated code, and `index.ts`; breaks below 70%
