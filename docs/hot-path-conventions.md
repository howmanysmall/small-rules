# Hot-Path Conventions for Rule Code

Visitors fire once per matching AST node, per file, per lint run. Per-node allocation and re-computation is where rules rot. These conventions apply to everything under `src/rules/` and `src/utilities/`.

See also [ADR-0001](./adr/0001-append-only-worklist-traversal.md) (worklist traversal) and the glossary in [CONTEXT.md](../CONTEXT.md) (worklist, dead branch, coverage pragma, unkillable mutant, variadic spread).

## 1. Hoist allocations out of visitors

Nothing constructed inside a visitor callback — `new RegExp`, `new Set`, `.filter().map()` intermediate arrays, closures passed to helpers — unless it genuinely depends on the node. Three tiers:

- **Module scope** — immutable constants (pattern Sets, precompiled regexes)
- **`create()` scope** — per-file, option-derived structures (compile option patterns once here)
- **`before` hook** — per-file mutable state in `createOnce` rules

## 2. No parse-per-lookup

Never re-derive a data structure from static data on every call (e.g. `str.split(",").includes(name)` per lookup). Materialize once at module init or memoize. Likewise, a list consulted per-node should be a `Set` built once in `create()`, not an `Array.prototype.includes` linear scan.

## 3. No stateful global-flag regexes for boolean tests

A shared `g`/`y` regex carries mutable `lastIndex` across calls, so `.test()` becomes position-dependent — a correctness bug, not just churn. Drop the `g` flag for boolean tests, or reset `lastIndex` explicitly.

## 4. No recursion or spread in AST walks

Native call-stack depth scales with AST depth, and generated/minified code nests pathologically deep (long `a + b + c + ...` chains). Recursion and `array.push(...children)` both crash with `RangeError` on adversarial input. Use the append-only worklist shape from ADR-0001.

## 5. Reset per-file state in `createOnce` rules

Module-level caches are only allowed for immutable facts (filesystem contents, compiled patterns). Any per-file accumulator must be reset in `before`; otherwise state bleeds across files, producing phantom reports that only reproduce in multi-file runs — invisible to single-file tests.

## 6. Analyze structurally, not textually

`sourceCode.getText(node)` slices a fresh string per call, and text comparison is fragile against whitespace and comments. Compare `range` tuples or walk the AST. Never compare nodes via `JSON.stringify`.

## 7. One pass, then `Program:exit`

Don't call a full-tree walk (`walkAst`) or an ancestor climb from inside a per-node visitor — that's O(n·depth) or O(n²). Accumulate during the single visitor pass and do cross-cutting analysis once in `Program`/`Program:exit`.

## Known violations (as of writing)

- `src/utilities/react-hook-utilities.ts` — `walkAst` uses the pop-based dead-branch shape ADR-0001 rejects; `walkAstSlop` recurses and allocates `Object.values(node)` per node (§4, §1)
- `src/generated/roblox-yielding-members.ts` — `classHasYieldingMember` splits a CSV string on every lookup (§2)
- `src/utilities/recognizers/contains-detector.ts` — compiles shared patterns with the `g` flag (§3)
- `src/rules/require-async-suffix.ts` — contains a type cast (`as ReadonlyArray<ESTree.Node>`), violating the repo-wide no-cast rule
