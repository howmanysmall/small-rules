# Migration: `prefer-expect-assertions-count` → `prefer-expect-assertions`

Commit `ff6d751` removed this rule and merged what it did into `prefer-expect-assertions`.

## What changed

Two rules became one. The `prefer-expect-assertions` rule now handles both jobs:

- **Require assertion guards.** Every test needs `expect.assertions(n)` or `expect.hasAssertions()` as its first expression.
- **Auto-fix `expect.hasAssertions()` to `expect.assertions(n)`.** When the rule can count a deterministic number of expect calls and nothing makes that count unknowable (no loops, callbacks, conditionals, or try/catch), it replaces `expect.hasAssertions()` with the concrete number. That was the whole point of the old rule.

## Config migration

**Before (two rules):**

```jsonc
"small-rules/prefer-expect-assertions": [
  "error",
  {
    "additionalExpectCallNames": ["expectRecord", "expectArray", "expectPresent"]
  }
],
"small-rules/prefer-expect-assertions-count": [
  "error",
  {
    "additionalAssertionFunctions": ["expectRecord", "expectArray", "expectPresent"]
  }
]
```

**After (one rule):**

```jsonc
"small-rules/prefer-expect-assertions": [
  "error",
  {
    "additionalAssertionFunctions": ["expectRecord", "expectArray", "expectPresent"],
    "additionalExpectCallNames": ["expectRecord", "expectArray", "expectPresent"]
  }
]
```

Make these two changes:

1. Delete the `prefer-expect-assertions-count` entry from your config.
2. If you had `additionalAssertionFunctions` on the old rule, move that array into the `prefer-expect-assertions` config. The option is supported there now.

If you had the old rule set to `"off"` in a global rules section, that line is dead weight. Remove it.

The `additionalExpectCallNames` option still works the same way: it tells the rule which function names count as expect calls. `additionalAssertionFunctions` is an alias that feeds into the same list (the rule deduplicates them internally).

## When the auto-fix fires

The auto-fix from `expect.hasAssertions()` to `expect.assertions(n)` only fires when:

- The assertion count is **deterministic**. No loops (`for`, `while`, `do-while`) around expect calls, no callbacks like `.forEach()` that make the count unknowable, no conditionals or try/catch with inconsistent paths.
- The test body is a **block statement** (`() => { ... }`), not an expression body (`() => ...`). Expression bodies get a suggestion instead of a fix.

When the count is indeterminate, the rule suggests `expect.hasAssertions()` instead. When the count is known, it suggests and (where structure allows) auto-fixes to `expect.assertions(n)`.

The old rule had the same logic. Now it is bundled inside `prefer-expect-assertions` and shares the same AST traversal, so linting is slightly faster.
