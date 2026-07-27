# Small Rules

An Oxlint-native lint plugin. Its domain is rule engineering: AST/scope analysis under a hard mandate of 100% Vitest coverage, Stryker mutation thresholds, and a no-cast type discipline. The terms below exist because violating them breaks that mandate.

## Language

**Worklist**:
An append-only array traversed with `for...of` while elements are pushed onto it; the array iterator re-reads `length` each step, so appended elements are visited. The canonical shape for tree/graph traversal in this repo.
_Avoid_: stack, queue, frontier

**Dead branch**:
A statically unreachable runtime branch forced by the type system (e.g. the `undefined` guard demanded by `Array.prototype.pop()` under `noUncheckedIndexedAccess`). Dead branches are design defects here, not annotations to excuse — they force coverage pragmas and breed unkillable mutants.
_Avoid_: defensive check, safety guard

**Coverage pragma**:
A `/* v8 ignore ... */` comment exempting a line from the 100% coverage mandate. Every pragma marks a dead branch; the goal is to design the branch away, not annotate it.
_Avoid_: ignore comment, coverage exception

**Unkillable mutant**:
A Stryker mutation that survives because it alters observationally equivalent code — almost always code inside a dead branch. Unkillable mutants are fixed by removing the dead branch, never by lowering thresholds.
_Avoid_: equivalent mutant (reserve for the general theory; here they are always symptoms of dead branches)

**Variadic spread**:
Spreading an unbounded array into a call (`array1.push(...array2)`), which passes every element as a stack-allocated argument. Banned in traversal code: engine argument-count limits turn pathological inputs into `RangeError` crashes.
_Avoid_: spread push
