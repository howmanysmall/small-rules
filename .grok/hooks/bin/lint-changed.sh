#!/usr/bin/env bash
# PostToolUse hook: lint files the agent just wrote or edited.
# Uses `node --run lint:agent` per AGENTS.md. Prints diagnostics when lint fails.

set -uo pipefail

root="${GROK_WORKSPACE_ROOT:-${CLAUDE_PROJECT_DIR:-${PWD}}}"
cd "${root}" || exit 0

if ! command -v jq >/dev/null 2>&1; then
	printf 'lint-changed: jq not found; skipping lint\n' >&2
	exit 0
fi

if ! command -v node >/dev/null 2>&1; then
	printf 'lint-changed: node not found; skipping lint\n' >&2
	exit 0
fi

input="$(cat)"

file_path="$(
	printf '%s' "${input}" | jq -r '
		.toolInput.file_path
		// .toolInput.filePath
		// .toolInput.target_file
		// .toolInput.path
		// .tool_input.file_path
		// .tool_input.filePath
		// .tool_input.target_file
		// .tool_input.path
		// empty
	'
)"

if [[ -z "${file_path}" || "${file_path}" == "null" ]]; then
	exit 0
fi

# Normalize to a path relative to the workspace when possible.
if [[ "${file_path}" == /* ]]; then
	case "${file_path}" in
	"${root}"/*)
		rel="${file_path#"${root}"/}"
		;;
	*)
		# Outside the workspace — do not lint.
		exit 0
		;;
	esac
else
	rel="${file_path}"
fi

# Skip non-source / generated / dependency paths.
case "${rel}" in
node_modules/* | */node_modules/* | dist/* | */dist/* | coverage/* | */coverage/* | \
	.stryker-tmp/* | */.stryker-tmp/* | report/* | reports/* | do-not-sync-ever/*)
	exit 0
	;;
esac

# Only lint extensions oxlint/biome care about in this repo.
case "${rel}" in
*.js | *.jsx | *.ts | *.tsx | *.mjs | *.cjs | *.mts | *.cts | *.astro | *.mdx | \
	*.css | *.html | *.grit | *.json | *.jsonc)
	;;
*)
	exit 0
	;;
esac

if [[ ! -f "${rel}" ]]; then
	exit 0
fi

# Avoid concurrent lint storms on the same file.
lock_dir="${TMPDIR:-/tmp}/small-rules-lint-changed"
mkdir -p "${lock_dir}"
# Portable hash without depending on md5sum/shasum flags.
lock_key="$(printf '%s' "${rel}" | cksum | awk '{print $1}')"
lock_file="${lock_dir}/${lock_key}.lock"
if ! mkdir "${lock_file}" 2>/dev/null; then
	exit 0
fi
trap 'rmdir "${lock_file}" 2>/dev/null || true' EXIT

output="$(node --run lint:agent -- "${rel}" 2>&1)"
code=$?

if [[ ${code} -eq 0 ]]; then
	exit 0
fi

# Surface failures so the agent can fix them.
# - Grok: hook stderr/stdout appears in scrollback annotations
# - Claude: exit 2 feeds stderr back; optional JSON adds systemMessage
message="$(printf 'lint:agent failed for %s\n\n%s' "${rel}" "${output}")"
printf '%s\n' "${message}" >&2

if [[ -z "${GROK_SESSION_ID:-}" ]]; then
	# Claude Code / other harnesses that honor JSON systemMessage.
	jq -nc --arg msg "${message}" \
		'{systemMessage: $msg, hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'
fi

exit 2
