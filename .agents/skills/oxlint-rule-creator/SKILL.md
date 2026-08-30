---
name: oxlint-rule-creator
description: Use when creating a new Oxlint JS plugin rule from scratch, or porting an existing ESLint rule to Oxlint. Covers createOnce, before/after hooks, all context/SourceCode APIs, fixes, suggestions, rule schemas, scope analysis, and RuleTester patterns. Do NOT use this for fixing existing rules - use the `fix-oxlint-rules` skill instead.
---

# Creating and Porting Oxlint JS Plugin Rules

## Read This First — Mandatory Execution Order

When this skill is active, you MUST follow this order:

1. Create or port the test file in `tests/`.
2. Add the initial valid/invalid cases, including one documented fail example
   and one documented pass example unless a reasoned exemption is necessary.
3. Only then implement the rule in `src/rules/<category>/`.
4. Register the rule in `src/index.ts` and update `tests/index.test.ts`.
5. Add the rule to the documentation manifest and create its MDX page under
   `documentation/src/content/docs/rules/`.
6. Run the targeted rule test, documentation coverage test, and
   documentation package unit tests (`cd documentation && pnpm exec vitest run tests/unit`),
   then the full required test/lint/type-check verification.

**Hard rule: never write the rule implementation before the test file exists. ALWAYS use TDD.**

## READ ME NOW

YOU **MUST** ALWAYS USE TDD. NO. EXCEPTIONS. YOU **MUST** ALWAYS USE TDD. NO. EXCEPTIONS. YOU **MUST** ALWAYS USE TDD. NO. EXCEPTIONS. YOU **MUST** ALWAYS USE TDD. NO. EXCEPTIONS. YOU **MUST** ALWAYS USE TDD. NO. EXCEPTIONS. YOU **MUST** ALWAYS USE TDD. NO. EXCEPTIONS. YOU **MUST** ALWAYS USE TDD. NO. EXCEPTIONS.

If you catch yourself drafting `src/rules/<category>/{rule-name}.ts` before drafting
`tests/{rule-name}.test.ts`, STOP at once. That is the wrong workflow for this
skill.

### Forbidden Behavior

- Do NOT start by writing the rule implementation.
- Do NOT provide an implementation-first example for a new rule.
- Do NOT say you will "add tests later".
- Do NOT skip tests because the rule "is simple".

### Required Self-Check Before Writing Rule Code

Before emitting any new rule implementation, verify:

- Does the test file already exist or have I written it in this response?
- Does it contain at least one `valid` and one `invalid` case?
- Am I implementing against those tests rather than inventing the rule first?

If any answer is no, do not write the implementation yet.

## Overview

Oxlint JS plugins use an ESLint-compatible API. Rules live under `src/rules/<category>/`
in this repo and are registered in `src/index.ts`.

**Nonnegotiable workflow for new rules: TDD is required.**

- Write or port the tests first in `tests/`.
- Only after the tests exist should you implement the rule.
- Then run the rule tests and iterate until they pass.

If you are creating a new rule and have not written the tests yet, stop and
write the tests first. An implementation-first rule is incorrect for this skill.

---

## Types Reference

All types come from `oxlint-plugin-utilities`. The most important:

```ts
import { definePlugin, defineRule } from "oxlint-plugin-utilities";
import type {
  Context,
  Visitor,          // AST node visitor map — returned by `create`
  VisitorWithHooks, // Visitor & { before?: BeforeHook; after?: AfterHook }
  BeforeHook,       // () => boolean | void
  AfterHook,        // () => void
  ESTree,
} from "oxlint-plugin-utilities";
```

`defineRule` and `definePlugin` are **identity no-ops** that exist purely for
TypeScript inference. They pass their argument through unchanged.

---

## `create` Vs `createOnce`

Both are valid. Choose based on what the rule actually needs.

### `create` - Called Once Per File

```ts
defineRule({
  create(context): Visitor {
    // Everything here runs fresh for each file.
    // Per-file state is naturally scoped — no reset needed.
    let count = 0;

    return {
      CallExpression(node) {
        count += 1;
      },
    };
  },
  meta: { ... },
});
```

**Use `create` when:**

- The rule has no state, or per-file state initialization is simpler inlined.
- The rule is ported from ESLint and the existing `create` shape is correct
  with no changes needed.
- The visitor object returned needs to differ between files.

### `createOnce` - Called Once Total; Per-File Setup Goes In `before`

```ts
import type { VisitorWithHooks } from "oxlint-plugin-utilities";

defineRule({
  createOnce(context): VisitorWithHooks {
    // Variables declared here are SHARED across all files.
    // Per-file state MUST be reset inside `before`.
    let count: number;

    return {
      before() {
        count = 0;
        // Optionally skip the entire file:
        // if (context.sourceCode.text.startsWith("// @generated")) return false;
      },

      CallExpression(node) {
        count += 1;
        if (count > 10) {
          context.report({
            messageId: "tooMany",
            data: { count: String(count) },
            node,
          });
        }
      },

      // after() runs once per file, after Program:exit.
      // Use it to release expensive resources acquired during traversal.
      after() {
        /* cleanup */
      },
    };
  },
  meta: { ... },
});
```

**Use `createOnce` when:**

- The rule accumulates per-file state across multiple node visits (counters,
  sets, maps) that needs a clean reset between files.
- The rule can benefit from early file-skipping via `before() { return false; }`.
- Writing a new rule from scratch where the `before`-init model is a natural
  fit for the state.
- The rule reads `context.options` (or any other per-file context field). Read
  them in `before()`, not at the top of `createOnce` and not per node.

### What `oxlint` Actually Does

From `node_modules/oxlint/dist/lint.js` (plugin load ~17881, per-file walk ~23904):

- `createOnce(context)` runs **once at plugin registration**. `filename`,
  `sourceCode`, `settings`, and friends throw if you touch them there
  (`Cannot access context.* in createOnce`). Options are not assigned yet.
- Per file, oxlint writes `context.options` onto that same context object,
  then either:
  - `createOnce`: call `before()` if present, reuse the stored visitor, or
  - `create`: `visitor = rule.create(context)` — **new visitor object every file**.
- The planned “skip `before` when the file has none of this rule’s node
  types” optimization is **not in the current release**. `before()` runs for
  every file.

The Vitest harness matches this: `createOnce` is called once with a shared
context; each test case then assigns `context.options` and runs `before`
before walking. Reading `context.options` at the top of `createOnce` sees
whatever the first case (or nothing) left there.

### Measured Cost (8000 Files, Node)

Option-derived data for a two-identifier allow-list, modeled on oxlint’s
loop. Fastest in each row is 1.00x.

| Workload | `createOnce` + per-node `options[0]?.x ?? []` | `create` (new visitor/file) | `createOnce` + `before()` cache |
| --- | --- | --- | --- |
| 0 assertion nodes/file | ~0.03 ms (2.7x) | 0.13 ms (**11x**) | ~0.03 ms (3.0x) |
| 1 node/file | 2.3x | 2.3x | **1.00x** |
| 8 nodes/file | 1.25x | 1.14x | **1.00x** |
| 80 nodes/file | 1.39x | 1.01x | **1.00x** |

Takeaways:

- **Do not use `create` just to read options once.** On files with no target
  nodes — the common case for a `TSAsExpression` rule — `create` is an order
  of magnitude slower because it allocates a visitor object per file.
- **Do not read options inside the visitor.** `?? []` allocates a fresh empty
  array on every node when the option is missing (the 80-node empty case was
  1.62x). Even when configured, the extra property walk shows up at 8–80 nodes.
- **`createOnce` + `before()` cache is the right default for option-derived
  data.** Same speed as `create` on assertion-heavy files, without `create`’s
  per-file alloc on empty ones. Hoist a module-level empty array and reuse it
  instead of `?? []`.

The “`create` with no state is already optimal” line is wrong for current
oxlint. `createOnce` without a `before` hook is cheapest when the visitor
never fires; add `before` when you have per-file inputs (options) or state.
The Rust-side skip-if-no-nodes plan is still forward-looking.

---

## Project Layout

```text
src/
├── index.ts                  ← registers all rules via definePlugin
├── rules/
│   └── {rule-name}.ts        ← one file per rule
├── types/
│   └── ...                   ← shared type definitions
└── utilities/
    ├── ast-utilities.ts
    ├── banned-global-call-rule.ts
    ├── casing-utilities.ts
    ├── component-utilities.ts
    ├── directive-comments.ts
    ├── expression-safety.ts
    ├── jest-utilities.ts
    ├── local-component-discovery.ts
    ├── oxc-utilities.ts
    ├── react-hook-utilities.ts
    ├── react-memo-utilities.ts
    ├── react-utilities.ts
    ├── static-expression-utilities.ts
    ├── prevent-abbreviations/
    └── recognizers/

tests/
├── index.test.ts             ← hardcoded expectedRuleNames list
├── rule-testers.ts           ← preconfigured RuleTester instances
└── {rule-name}.test.ts       ← one test file per rule
```

---

## Full Rule File — `create`

```ts
import { defineRule } from "oxlint-plugin-utilities";
import type { Visitor } from "oxlint-plugin-utilities";

const myRule = defineRule({
  create(context): Visitor {
    return {
      Identifier(node): void {
        if (node.name === "forbidden") {
          context.report({ messageId: "noForbidden", node });
        }
      },
    } satisfies Visitor;
  },
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the identifier 'forbidden'.",
      recommended: true,
    },
    messages: {
      noForbidden: "The identifier 'forbidden' is not allowed.",
    },
    schema: [],
  },
});

export default myRule;
```

---

## Full Rule File — `createOnce`

```ts
import { defineRule } from "oxlint-plugin-utilities";
import type { VisitorWithHooks } from "oxlint-plugin-utilities";

const myRule = defineRule({
  createOnce(context): VisitorWithHooks {
    let count: number;

    return {
      before() {
        count = 0;
      },

      CallExpression(node) {
        count += 1;
        if (count > 10) {
          context.report({
            messageId: "tooMany",
            data: { count: String(count) },
            node,
          });
        }
      },

      after() {
        /* release any expensive per-file resources */
      },
    };
  },
  meta: {
    type: "problem",
    docs: {
      description: "Limit call count per file.",
      recommended: true,
    },
    messages: {
      tooMany: "{{count}} calls detected — consider refactoring",
    },
    schema: [],
  },
});

export default myRule;
```

---

## `before` Hook — Details

`before()` runs before AST traversal for a file.

- Return `false` → skip traversal AND `after` for this file.
- Return `void` / `undefined` → proceed normally.

**Critical caveat:** `before` is NOT guaranteed to run on every file in future
Oxlint releases. Oxlint plans to skip entire rule execution (including `before`)
for files whose AST contains none of the node types the rule visits. If code
must run unconditionally for every file, use a `Program` visitor — it always
fires regardless of other content.

```ts
return {
  Program(node) {
    // Always runs for every file, even if no FunctionDeclaration is present.
  },
  FunctionDeclaration(node) {
    // Only runs when a FunctionDeclaration exists in the file.
  },
};
```

---

## Registering In `index.ts`

```ts
import { definePlugin } from "oxlint-plugin-utilities";
import myRule from "$oxc-rules/<category>/my-rule";

const smallRules = definePlugin({
  meta: { name: "small-rules" },
  rules: {
    "my-rule": myRule,
  },
});

export default smallRules;
```

**Also add the rule name to `tests/index.test.ts`** — the `expectedRuleNames`
array and `toHaveLength` assertion in that file must be kept in sync with
`src/index.ts`, or `nr test:agent` will fail.

---

## Documenting a New Rule

Documentation is part of the rule, not follow-up work. Complete all applicable
artifacts below for every new rule.

### 1. Mark One Failing and One Passing Test Case for Documentation

The documentation site extracts examples directly from the rule test. Exactly
one `invalid` case and one `valid` case must be objects with static
`documentation` metadata:

```ts
ts.run("my-rule", myRule, {
  invalid: [
    {
      code: "forbidden();",
      documentation: { id: "fail", title: "Forbidden call" },
      errors: [{ messageId: "noForbidden" }],
    },
  ],
  valid: [
    {
      code: "allowed();",
      documentation: { id: "pass", title: "Allowed call" },
    },
  ],
});
```

Use representative examples that teach the rule. The `id` and `title` must be
static strings. Do not attach `documentation` to more than one passing or
failing case. If a useful example is genuinely impractical, add a specific
`exampleExemption` to the manifest entry instead of inventing a misleading
example.

Documented `code` is rendered verbatim on the docs site. Multi-statement
examples must use real newlines via `.join("\n")` arrays — never a single-line
string with multiple statements (the page will show one collapsed line).
Short single-statement bodies like `if (flag) doThing();` are fine as one line.
`tests/documentation-rule-coverage.test.ts` fails the build if a documented
example is a multi-statement one-liner.

### 2. Add the Rule to the Documentation Manifest

Add `{ name: "my-rule" }` to the correct category in
`documentation/src/data/rule-manifest.ts`:

- `general` — control flow, correctness, and general code quality
- `naming` — naming, type style, and file conventions
- `react` — React components, hooks, and JSX
- `roblox` — Roblox and Luau APIs

The manifest drives the rule index, category pages, sidebar, facts, options,
and canonical route. Do not duplicate that data elsewhere. Add an entry to
`documentation/src/data/rule-relations.ts` only when a real relationship with
another rule exists.

### 3. Create the Thin MDX Page

Create
`documentation/src/content/docs/rules/{category}/{rule-name}.mdx` using the
shared rule page component:

```mdx
---
title: "My Rule"
---

import RulePage from "$components/rule-page.astro";

<RulePage rule="my-rule" />
```

Use the title produced by `formatRuleTitle` in
`documentation/src/data/rule-manifest.ts`. Do not copy diagnostics,
configuration, options, or examples into MDX; `RulePage` derives them from the
rule metadata, manifest, and documented test cases. Add a rationale slot only
when the rule needs explanation beyond those generated sections.

### Documentation Completion Gate

Run the rule test and the documentation coverage test together:

```sh
nr test:agent tests/my-rule.test.ts tests/documentation-rule-coverage.test.ts
```

Also run the documentation package unit tests when you change the manifest or
add MDX pages (CI job `checks / Documentation` runs these):

```sh
cd documentation && pnpm exec vitest run tests/unit
```

The documentation coverage test must prove that the plugin, manifest, MDX
pages, and extracted examples agree. A new rule is incomplete until this test
passes.

### Never Hardcode Catalog Counts

Adding a rule to `rule-manifest.ts` changes category sizes on the docs rule
index. **Do not** hardcode numbers like `"Showing 7 rules"` or
`toHaveCount(7)` for a category in:

- `documentation/tests/unit/rule-index.test.tsx`
- `documentation/tests/browser/documentation.test.ts`

Those tests **must** derive counts from the catalog/manifest data (or count
DOM cards after filtering). If you introduce a new assertion about how many
rules appear in a category, compute it from `catalogCategories` /
`ruleFactCategories` (or live card count), never a literal integer that will
rot on the next rule addition.

---

## Registering in Configuration

You MUST build and copy the plugin to `plugins/small-rules.js` BEFORE testing
the rule in the codebase. The easiest way is `nr build:local`, which
runs `nr build --minify` and copies `dist/index.js` to `plugins/small-rules.js`.

You MUST run `nr lint:agent src tests` to run both Oxlint and Biome checks.

```jsonc
// .oxlintrc.json
{
  "jsPlugins": ["./plugins/small-rules.js"],
  "rules": { "small-rules/my-rule": "error" }
}
```

```ts
// oxlint.config.ts
import { defineConfig } from "oxlint";
export default defineConfig({
  jsPlugins: ["./plugins/small-rules.js"],
  rules: { "small-rules/my-rule": "error" },
});
```

---

## `context.report`

`Diagnostic` requires at least one of `node`/`loc` AND one of `message`/`messageId`.

### Basic

```ts
context.report({ messageId: "myMessage", node });
context.report({ message: "Literal string message", node });
```

### With Data Interpolation

```ts
// meta.messages.tooMany = "{{count}} calls found"
context.report({ messageId: "tooMany", data: { count: String(n) }, node });
```

### With a Fixer (Auto-Fix)

`meta.fixable` must be `"code"` or `"whitespace"`.

```ts
context.report({
  messageId: "useConst",
  node,
  fix(fixer) {
    return fixer.replaceText(node, "const");
    // Other methods:
    // fixer.insertTextBefore(node, "/* before */ ")
    // fixer.insertTextAfter(node, ";")
    // fixer.remove(node)
    // fixer.removeRange([start, end])
    // fixer.replaceTextRange([start, end], "new text")
    // Multiple fixes: return [fixer.remove(a), fixer.insertTextAfter(b, "x")]
  },
});
```

### With Suggestions (Non-Auto-Applied IDE Quick-Fixes)

`meta.hasSuggestions` must be `true`.

```ts
context.report({
  messageId: "preferConst",
  node,
  suggest: [
    {
      messageId: "changeToConst",
      fix(fixer) {
        return fixer.replaceText(node, node.raw.replace("let", "const"));
      },
    },
  ],
});
```

### Reporting at a Custom Location

```ts
context.report({
  messageId: "something",
  loc: { line: 3, column: 5 },
  // Or a range:
  // loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 5 } },
});
```

---

## Rule Options / Schema

Accessed via `context.options[0]`, `context.options[1]`, etc.

```ts
const DEFAULT_THRESHOLD = 5;

createOnce(context): VisitorWithHooks {
  // Options are not assigned yet. Do not read context.options here —
  // oxlint calls createOnce at plugin load; the harness calls it once
  // for the whole test file.
  let threshold = DEFAULT_THRESHOLD;
  let count: number;
  return {
    before() {
      threshold = context.options[0]?.threshold ?? DEFAULT_THRESHOLD;
      count = 0;
    },
    CallExpression(node) {
      count += 1;
      if (count > threshold)
        context.report({ messageId: "exceeded", node });
    },
  };
},
meta: {
  type: "problem",
  docs: { description: "...", recommended: false },
  messages: { exceeded: "Exceeded threshold" },
  schema: [
    {
      type: "object",
      properties: { threshold: { type: "number", minimum: 1 } },
      additionalProperties: false,
    },
  ],
},
```

Config usage: `{ "small-rules/my-rule": ["error", { "threshold": 10 }] }`

---

## `SourceCode` APIs

```ts
create(context): Visitor {
  const { sourceCode } = context;
  return {
    Identifier(node) {
      const text = sourceCode.getText(node);
      const withContext = sourceCode.getText(node, 2, 2); // chars before/after
      const tokens = sourceCode.getTokens(node);
      const tokenBefore = sourceCode.getTokenBefore(node);
      const tokenAfter = sourceCode.getTokenAfter(node);
      const leadingComments = sourceCode.getCommentsBefore(node);
      const trailingComments = sourceCode.getCommentsAfter(node);
      const ancestors = sourceCode.getAncestors(node); // ESLint v9
      const fullSource = sourceCode.text;
    },
  };
},
```

---

## Scope Analysis

```ts
create(context): Visitor {
  return {
    "Program:exit"(node) {
      const scope = context.sourceCode.getScope(node);
      for (const variable of scope.variables) {
        for (const reference of variable.references) {
          if (reference.isWrite()) {
            context.report({ messageId: "noWrite", node: reference.identifier });
          }
        }
      }
    },
  };
},
```

---

## AST Traversal Patterns

### Exit Visitors

```ts
return {
  FunctionDeclaration(node) { /* enter */ },
  "FunctionDeclaration:exit"(node) { /* exit */ },
};
```

### ESLint Selectors

```ts
return {
  "Program > VariableDeclaration"(node) { ... },
  "CallExpression[callee.name='useEffect']"(node) { ... },
};
```

### `node.parent`

Always available, no API call needed.

```ts
CallExpression(node) {
  if (node.parent?.type === "ExpressionStatement") { ... }
},
```

---

## `RuleTester` (Test Harness)

Testing is required for every new rule and every ported rule.

**TDD is mandatory here:** create or port the test file first, then implement
the rule against those tests. Do not start by writing the rule implementation.

Do NOT recreate `new RuleTester()` like in the example below; use the
preconfigured testers from `tests/rule-testers.ts`.

```ts
// tests/my-rule.test.ts
import { describe } from "vitest";
import myRule from "$oxc-rules/<category>/my-rule";
import { ts } from "./rule-testers";

describe("my-rule", () => {
  // @ts-expect-error -- RuleTester types are permissive
  ts.run("my-rule", myRule, {
    valid: [
      `const x = 1;`,
      { code: `const x = 1;`, options: [{ threshold: 20 }] },
    ],
    invalid: [
      {
        code: `badCall(); badCall(); badCall();`,
        errors: [{ messageId: "tooMany" }],
        // Assert output if the rule is fixable:
        // output: `/* fixed */`,
      },
    ],
  });
});
```

Run: `nr test:agent tests/my-rule.test.ts`

Do not place rule tests anywhere else.

---

## Porting an ESLint Rule to Oxlint

### Step 1 - Check for Native Coverage First

```sh
nr oxlint --rules | rg rule-name
```

If the rule exists natively in Oxlint, use it rather than duplicating it as a
JS plugin.

### Step 2 - Wrap with `defineRule`, Convert to ESM

```ts
import { defineRule } from "oxlint-plugin-utilities";

const myRule = defineRule({
  create(context) { /* existing ESLint body, unchanged */ },
  meta: { ... },
});
export default myRule;
```

### Step 3 - Decide Whether to Upgrade To `createOnce`

Apply the same decision guide from above. If the ESLint rule initializes
per-file state at the top of `create`, that state is a natural candidate for
`createOnce` + `before`. If `create` has no per-file state, leave it as
`create`.

**Mechanical transformation for rules with per-file state:**

```ts
// Before (ESLint create)
create(context) {
  const seen = new Set<string>(); // per-file in ESLint, naturally
  return {
    Identifier(node) {
      if (seen.has(node.name)) context.report({ ... });
      seen.add(node.name);
    },
  };
},

// After (createOnce + before)
createOnce(context): VisitorWithHooks {
  let seen: Set<string>;
  return {
    before() { seen = new Set(); },
    Identifier(node) {
      if (seen.has(node.name)) context.report({ ... });
      seen.add(node.name);
    },
  };
},
```

Early-return patterns:

| ESLint `create`                      | `createOnce` equivalent                           |
|--------------------------------------|---------------------------------------------------|
| `if (condition) return {};`          | `before() { if (condition) return false; }`       |

### Step 4 - Replace Deprecated pre-V9 Context APIs

Oxlint does not implement APIs removed before ESLint V9.

| Deprecated (pre-V9)                 | ESLint V9 / Oxlint equivalent                |
|-------------------------------------|----------------------------------------------|
| `context.getScope()`                | `context.sourceCode.getScope(node)`          |
| `context.getAncestors()`            | `context.sourceCode.getAncestors(node)`      |
| `context.getDeclaredVariables(n)`   | `context.sourceCode.getDeclaredVariables(n)` |
| `context.getSourceCode()`           | `context.sourceCode`                         |
| `context.parserServices`            | `context.sourceCode.parserServices`          |

### Step 5 - Ensure `meta.schema` Is Present

Rules that omit `schema` need `schema: []` added explicitly.

### Step 6 - Port Tests and Register

Required.

This step is TDD-gated: write or port the tests first in `tests/`, then
implement the rule, register it in `src/index.ts`, and add the name to
`tests/index.test.ts`.

If the tests do not exist yet, do not proceed to the implementation step.

For LLMs: if you are about to output the rule file before the test file, that
output is wrong. Reorder your work so the tests come first.

---

## Reference - Existing Rule Patterns in This Codebase

| Rule | Key pattern |
|------|------------|
| `no-cascading-set-state` | `walkAst` subtree walk; counting patterns |
| `no-giant-component` | Reporting on a child node (`nameNode`) not the root |
| `no-inline-property-on-memo-component` | Cross-visitor set state (`memoizedComponentNames`) |
| `no-use-memo-simple-expression` | Delegating detection to utility functions |
| `prefer-use-reducer` | Inline `message` string (no `messageId`) |
| `rerender-memo-with-default-value` | Multiple `messageId`s; helper function with `context` threaded in |

### Available Utility Modules

Please create new utility functions / modules to reduce duplicated code.

- `component-utilities` — `isComponentDeclaration`, `isMemoCall`, `isSimpleExpression`
- `jest-utilities` — Vitest matcher and assertion pattern detection
- `oxc-utilities` — `isNode` type guards, `isCallExpression`, `isIdentifierNamed`, etc.
- `react-hook-utilities` — `getHookName`, `getEffectCallback`, `countSetStateCalls`, `walkAst`, `walkAstSlop`
- `react-memo-utilities` — React `memo` detection helpers
- `react-utilities` — React component helpers
- `ast-utilities` — AST traversal helpers (e.g. `getMemberPropertyName`)
- `expression-safety` — Side-effect-free expression checking
- `static-expression-utilities` — Constant expression evaluation
- `casing-utilities` — Case convention checks
- `local-component-discovery` — Finding locally-defined React components
- `directive-comments` — ESLint-style directive comment parsing
- `recognizers/` — Pattern detectors for code style analysis
- `prevent-abbreviations/` — Abbreviation detection and rule logic

---

## Verification Checklist

- [ ] Rule file at `src/rules/<category>/{rule-name}.ts`
- [ ] Tests at `tests/{rule-name}.test.ts`
- [ ] Tests were written or ported before the rule implementation (required; do not skip)
- [ ] I did not output implementation-first code for a new rule
- [ ] `create` vs `createOnce` chosen deliberately per the decision guide
- [ ] Per-file state (if any) initialized in `before`, not at top of `createOnce`
- [ ] Registered in `src/index.ts`
- [ ] **Added to `tests/index.test.ts`** — this file has a hardcoded
      `expectedRuleNames` array and length assertion that MUST be updated when
      adding a rule, or `nr test:agent` will fail.
- [ ] Exactly one documented failing case and one documented passing case in
      `tests/{rule-name}.test.ts`, or a reasoned manifest `exampleExemption`
- [ ] Added to the correct category in
      `documentation/src/data/rule-manifest.ts`
- [ ] Thin rule page created at
      `documentation/src/content/docs/rules/{category}/{rule-name}.mdx`
- [ ] Did **not** hardcode docs catalog/category rule counts; counts come from
      the manifest/catalog (see "Never Hardcode Catalog Counts")
- [ ] Targeted rule and documentation coverage tests pass
      (`nr test:agent tests/{rule-name}.test.ts tests/documentation-rule-coverage.test.ts`)
- [ ] Documentation package unit tests pass
      (`cd documentation && pnpm exec vitest run tests/unit`)
- [ ] `meta.fixable` set if the rule emits fixes
- [ ] `meta.hasSuggestions: true` if the rule emits suggestions
- [ ] `meta.schema` present (even as `[]`)
- [ ] Full tests pass (`nr test:agent`)
- [ ] `nr lint:agent` passes for every changed file
- [ ] `nr type-check:agent` passes
- [ ] Rule enabled in `.oxlintrc.json` or `oxlint.config.ts` if it should be active
