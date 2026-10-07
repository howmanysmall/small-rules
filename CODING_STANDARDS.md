# Coding Standards

## Types

Never cast. Types flow from their source: `createRule` infers a rule's option type from its `schema`, and the node guards in `@small-rules/oxlint-utilities` narrow ESTree nodes.

## Tests First

Red first: write the failing test, make it green, then refactor. Coverage is 100% (`vitest.config.ts` sets the threshold). A coverage pragma (`/* v8 ignore */`) marks a dead branch; design the branch away. `GLOSSARY.md` defines both terms.

## Gates

A change is done when all three pass on every file you touched:

| Gate | Command |
|------|---------|
| Lint (oxlint via `isentinel-lint`, then Biome) | `nr lint:agent [files...]` |
| Unit tests with coverage | `nr test:agent` |
| Type check (`tsgo`) | `nr type-check:agent` |

Use the `:agent` variants; they emit compact output. `nr format` (Biome, then oxfmt) fixes a formatting failure. Run one test file with `nr test:agent -- tests/rules/roblox/no-print.test.ts`, or a name pattern with `nr test:agent -t "no-print"`.

## Hot Paths

Before editing anything under `src/rules/` or `src/utilities/`, read [`docs/hot-path-conventions.md`](docs/hot-path-conventions.md): hoist allocations out of visitors and traverse with a worklist.

## Test Conventions

A rule's test is `tests/rules/<category>/<rule>.test.ts`. Import a runner (`js`, `jsx`, `ts`, or `tsx`) from `@small-rules/rule-harness/rule-testers`; options and settings are plain JSON.

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

Documented examples (`documentation: { id, title }` on a case) render verbatim on the docs site. Write a multi-statement snippet as an array joined with `"\n"`; `tests/documentation/rule-examples.test.ts` fails on a single-line multi-statement example.

A new fixable rule needs a program generator in `tests/properties/support/fixable-cases-*.ts`; `tests/properties/fixes-settle.test.ts` fails until it has one. Property tests take their run count from `PROPERTY_RUNS` in `tests/property-runs.ts` so the weekly deep run can raise it.

## Beyond the Rule

- **Docs site**: when adding or removing a rule, update `documentation/src/data/rule-manifest.ts` and run `cd documentation && pnpm exec vitest run tests/unit`. Derive category counts in docs tests from the manifest so the next rule lands without touching them.
- **Dependencies**: add with `pnpm add` (`-D` for dev); versions resolve through the catalogs in `pnpm-workspace.yaml`.
- **Vendored code**: before copying third-party code into the repo, read [`docs/vendoring.md`](docs/vendoring.md).
