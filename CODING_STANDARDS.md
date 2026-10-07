# Coding Standards

Standards for every change under `src/`, `tests/`, `tools/`, `scripts/`, and `packages/`. The `code-review` skill reads this file as its Standards source, so keep each rule here accurate and enforceable.

## Types

Never cast. Every value is typed at its source: `createRule` infers a rule's option type from its `schema`, the node guards in `@small-rules/oxlint-utilities` narrow ESTree nodes, and a value that only a cast would satisfy is a design defect to fix where the value is produced.

## Tests First

Write the failing test, make it pass, then refactor. Coverage is 100% (`vitest.config.ts` sets the threshold). A `/* v8 ignore */` pragma marks a dead branch; design the branch away instead of annotating it. `CONTEXT.md` defines both terms.

## Gates

A change is done when all three pass:

| Gate | Command |
|------|---------|
| Lint (oxlint via `isentinel-lint`, then Biome) | `nr lint:agent [files...]` |
| Unit tests with coverage | `nr test:agent` |
| Type check (`tsgo`) | `nr type-check:agent` |

The `:agent` variants emit compact output; use them instead of `lint`, `test`, and `type-check`. `nr` runs a `package.json` script (`@antfu/ni`). Run one test file with `nr test:agent -- tests/rules/roblox/no-print.test.ts`, or a name pattern with `nr test:agent -t "no-print"`.

## Hot Paths

Before editing anything under `src/rules/` or `src/utilities/`, read [`docs/hot-path-conventions.md`](docs/hot-path-conventions.md). Visitors run once per node per file, so per-node allocation, stateful `g` regexes, recursion, and spread in AST walks are the defects to design out. ADR-0001 covers the worklist shape.

## Test Conventions

A rule's test is `tests/rules/<category>/<rule>.test.ts`. The harness is the workspace package `@small-rules/rule-harness` (`tools/rule-harness`); import a runner from `@small-rules/rule-harness/rule-testers`: `js`, `jsx`, `ts`, or `tsx`. It parses with `yuku-parser`, runs rules directly in Vitest, supports `create` and `createOnce`, and takes JSON options only (no legacy rule tester, `languageOptions.parser`, or parser objects).

```ts
import { describe } from "vitest";
import { js } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/roblox/no-print";

describe("no-print", () => {
	js.run("no-print", rule, {
		invalid: [{ code: "print('Hello');", errors: [{ messageId: "noPrint" }] }],
		valid: ["Log.info('Hello');"],
	});
});
```

`invalid` cases pair code with the expected `messageId`s; `valid` cases are code strings that report nothing.

Documented examples (`documentation: { id, title }` on a case) render verbatim on the docs site. Write a multi-statement snippet as an array joined with `"\n"`; `tests/documentation/rule-examples.test.ts` fails on a single-line multi-statement example.

A new fixable rule needs a program generator in `tests/properties/support/fixable-cases-*.ts`; `tests/properties/fixes-settle.test.ts` fails until it has one. Property tests take their run count from `PROPERTY_RUNS` in `tests/property-runs.ts` so the weekly deep run can raise it.

## Docs Site

When adding or removing a rule, update `documentation/src/data/rule-manifest.ts` and run `cd documentation && pnpm exec vitest run tests/unit` (the `Documentation` CI job). Derive category counts in docs tests from the manifest; a hardcoded count breaks on the next rule.

## Dependencies

`pnpm add` (with `-D` for dev dependencies) is the only way to add a dependency; the workspace resolves versions through the catalogs in `pnpm-workspace.yaml`.

## Vendored Code

When copying third-party code into the repo, follow [`docs/vendoring.md`](docs/vendoring.md). Each component is described once, in `VENDORED_COMPONENTS` in `scripts/utilities/vendored-notices.ts`; `THIRD-PARTY-NOTICES.md` and the `dist/index.js` legal banner are generated from it by `nr generate:third-party-notices`, and `tests/tooling/third-party-notices.test.ts` fails on drift.
