---
name: fix-oxlint-rules
description: Use when an Oxlint small-rule or plugin rule in this repo fails unit tests, `tsgo`, or disagrees with an upstream port. You should NOT use this when CREATING a new rule. It is ONLY for fixing.
---

# Fix Oxlint Rules

## Overview

Fix the rule, not the symptom. Reproduce the exact failure, compare the local
rule, the test, and the upstream port when available, decide which one is most
accurate, then make the smallest targeted change and verify with the
project-specific commands.

## When to Use Me

Use this skill when:

- `nr test:agent tests/<rule>.test.ts` fails.
- `nr type-check` fails on a rule.
- The failure looks like AST narrowing, bad detection logic, broken fixer
  output, wrong `messageId`, or missing rule metadata.
- The local rule may be intentionally more precise than upstream, so the test
  or the port could be the thing that is stale.

Do not use this skill for:

- Problems outside rule logic (e.g. build tooling, release scripts).
- General ESLint config work outside the rule files.
- Broad lint cleanup that is not tied to one failing rule.

## Quick Reference

| Goal | Command |
| --- | --- |
| Reproduce one rule test | `nr test:agent -- tests/<rule>.test.ts` |
| Lint the touched rule files | `nr lint:agent src/rules/<rule>.ts tests/<rule>.test.ts` |
| Check type errors | `nr type-check` |
| Find rule wiring | `rg -n "<rule-name>" src tests` |
| Inspect test expectations | `sed -n '1,260p' tests/<rule>.test.ts` |

## Procedure

1. Reproduce the failure with the smallest focused test command.
2. Read the local rule and the failing test together.
3. Identify the exact mismatch before editing:
   `predicate`, helper usage, fixer behavior, `messageId`, `schema`, or
   `fixable`.
4. Decide which artifact is wrong:
   - If local rule and upstream agree but the test disagrees, the test is
     probably stale.
   - If upstream and the test agree but the local rule is less precise or
     accidentally broader, the rule likely drifted.
   - If the local rule is more precise than upstream and the test is failing
     because it expects the older behavior, prefer the more precise local
     behavior when it matches repo intent.
5. Determine repo intent before changing anything:
   inspect rule messages, option schema, helper usage, neighboring rules, and
   whether the local behavior reduces false positives or improves fixer safety.
   Upstream is a reference, not an automatic source of truth.
6. Change the smallest correct artifact:
   rule, test, or both.
7. Rerun the focused test.
8. Run `nr lint:agent src/rules/<rule>.ts tests/<rule>.test.ts`.
9. Rerun `nr type-check`.
10. Stop there unless the specific failure shows a wider plugin surface needs verification.

## Common Failure Patterns

- The rule reports correctly but never auto fixes because `meta.fixable` is
  missing.
- A fixer closes over `node.callee` after narrowing, but the callback no longer
  sees the narrowed type.
- Computed members like `binding["map"]` are treated as plain `.map()` calls.
- The local port drifted from upstream in one small guard or helper.
- The test is asserting the right message but the wrong output, or the reverse.
- The local rule intentionally tightened behavior, but the test still reflects
  the upstream port.

## Example

For `no-identity-map`:

1. Run `nr test:agent tests/no-identity-map.test.ts`.
2. Read the local rule and test side by side.
3. Check for:
   missing `fixable: "code"`, computed-member handling, and narrowed AST values
   captured inside the fixer.
4. If the local rule is intentionally stricter or safer than upstream, update
   the test instead of flattenening the rule back to the port.
5. Rerun the focused test, then run
   `nr lint:agent src/rules/no-identity-map.ts tests/no-identity-map.test.ts`,
   then rerun `nr type-check`.

## Common Mistakes

- Changing the test first because it is faster.
- Running `nr build` when the failure is rule-logic specific (build validates
  bundling, not rule correctness).
- Running the full `nr test:agent` suite when a single rule test is enough.
- Bundling unrelated cleanup into the same rule fix.
- Stopping after `nr test:agent tests/<rule>.test.ts` without checking the targeted
  lint command and `type-check`.
- Assuming the port is always correct without judging repo intent.
- Assuming the failing test is always correct without judging rule precision.

## References

- `tests/rule-testers.ts`
- `src/rules/`
- `tsconfig.json`
