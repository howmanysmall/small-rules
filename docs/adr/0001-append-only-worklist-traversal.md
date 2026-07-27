# Append-only worklist traversal instead of pop-based stacks

Tree/graph traversals (scope trees, AST walks) use an append-only worklist: a `for...of` loop over an array that is `push`ed onto during iteration. The array iterator protocol re-reads `length` on every `next()`, so appended elements are visited — this is deliberate, not a bug.

We rejected the conventional `while (items.length > 0) { const item = items.pop(); ... }` shape because under `noUncheckedIndexedAccess`, `pop()` returns `T | undefined` and forces a statically unreachable `undefined` guard. That dead branch requires `/* v8 ignore */` pragmas to satisfy the 100% coverage mandate and produces unkillable Stryker mutants (mutating the guard is observationally equivalent). The no-cast rule forbids asserting the guard away.

Traversals must also never spread an unbounded array into a call (`items.push(...children)`): each element becomes a stack-allocated argument, and engine argument-count limits (~65k) turn large machine-generated inputs into `RangeError` crashes. Push per element in a loop instead.

## Consequences

- Worklists retain O(n) references (the array never shrinks) instead of a pop-based frontier. Acceptable: the traversed objects already exist; only references are retained.
- Traversal order is BFS-like (insertion order). Traversal helpers must not promise DFS order.
