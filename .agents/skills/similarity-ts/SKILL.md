---
name: similarity-ts
description: Detect duplicated or structurally-similar TypeScript/JavaScript code with similarity-ts (AST-based jscpd replacement). Use when hunting clones, copy-paste, or repeated logic across functions, types, or classes. Hand findings to dry-refactoring to fix them.
---

# `similarity-ts`

Find **clones** — duplicated or structurally-similar code — with `similarity-ts`, an AST-based detector that catches similar logic even when identifiers differ (where token matchers like `jscpd` miss it).

This skill *detects*. To eliminate what it finds, hand off to the **dry-refactoring** skill.

## Run

```bash
mise run duplicates        # alias: dupes — runs similarity-ts --print on src
```

For anything beyond the default, call the binary directly: `similarity-ts <flags> <paths>`.

## Flags

**Scope** — what to compare (functions only, by default):

- `--types` / `--classes` — also compare type literals / classes
- `--types-only` / `--classes-only` / `--interfaces-only` — compare *only* that kind
- `-e, --extensions <list>` — file extensions to scan
- `--exclude <pattern>` — skip matching directories (repeatable)
- `--filter-function <substr>` / `--filter-function-body <substr>` — restrict to matching functions

**Sensitivity** — how loud the report is:

- `-t, --threshold <0.0-1.0>` — similarity cutoff (default 0.87); raise toward `0.9` for near-exact clones, lower to surface looser structural matches
- `-m, --min-lines <n>` — ignore functions shorter than n lines; raise to `10` to cut noise
- `--min-tokens <n>` — ignore functions below a token count
- `--structural-weight` / `--naming-weight` — trade structural shape against identifier names (default `0.6` / `0.4`)

**Output / CI:**

- `-p, --print` — show each clone pair side by side
- `--fail-on-duplicates` — exit `1` when any clone is found (gate a CI job)
- `--show-ignored` — list items suppressed by `similarity-ignore` comments

## Read the Report

`similarity-ts` groups results by kind (functions, types, type literals). For each pair it prints both locations (`file:line`), the names, and a similarity score split into **structural** (shape) and **naming** (identifiers).

Triage from highest similarity down. Treat a pair as a real clone — not noise — when its structural score is high and the fragment is longer than `--min-lines`. A purely high *naming* score on tiny fragments is usually incidental.

## Suppress a Known Clone

Mark intentional duplication so it stops surfacing:

```ts
// similarity-ignore
function intentionallyParallel() { /* ... */ }
```

## Notes

- Compares functions, types, and classes — not arbitrary token spans. It catches renamed-but-similar logic `jscpd` misses, but won't flag duplicated non-declaration blocks.
- AST-based and Rust-fast; safe to run over all of `src` on every change.
