# Fallow

Fallow is the changed-code quality gate (dead code, duplication, health) and the tracing tool to run before deleting, moving, or auditing code. `fallow.toml` holds its entry points, ignores, rule severities, thresholds, and the audit gate setting.

## Local Gate

Before any `git commit` or `git push`, run `fallow audit --format json --quiet --explain --gate-marker agent`. If the verdict is `fail`, fix the reported findings before retrying. Treat JSON runtime errors like `{ "error": true, ... }` as non-blocking.

The audit gates on `new-only`: only findings introduced by the current changeset affect the verdict. Inherited findings on touched files are reported under `attribution` with `introduced: false` and do not block.

In Claude Code, `.claude/hooks/fallow-gate.sh` runs this audit on every `git commit` and `git push` and blocks a `fail` verdict; the hk pre-push hook runs `mise run fallow:audit-hk` as well. Any other agent runs the command itself.

## Task Map

| When you are about to... | Run |
|---|---|
| delete an "unused" export or file | `fallow dead-code --trace <file>:<export>` |
| prove a TypeScript symbol's exact consumers before refactoring | `fallow dead-code --type-aware --symbol-impact <file>:<export-or-class.method>` |
| find how one module reaches another | `fallow trace --path <from> <to>` |
| delete an "unused" dependency | `fallow dead-code --trace-dependency <name>` |
| find every unused file, export, type, or dependency | `nr fallow:dead-code` |
| find duplicated and structurally-similar code | `nr fallow:dupes` |
| commit or open a PR | `fallow audit --base <ref>` (`nr fallow:audit`) |
| read a diff before approving it | `fallow review --base <ref> --brief` (orientation only, never gates) |
| prioritize refactoring | `fallow health --hotspots --targets` (`nr fallow:health`) |
| ask who owns code | `fallow health --ownership` |
| check untested-but-reachable code | `fallow health --coverage-gaps` |
| consolidate duplication | `fallow dupes --trace dup:<fingerprint>` |
| find feature flags | `fallow flags` |
| check which architecture rules apply to a file before changing it | `fallow guard <files>` |
| surface security candidates | `fallow security` |
| understand a finding | `fallow explain <issue-type>` |
| scope a monorepo | `--workspace <glob>` / `--changed-workspaces <ref>` (global flags, prefix any command) |
