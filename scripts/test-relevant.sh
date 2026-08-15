#!/usr/bin/env bash

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2> /dev/null || pwd)"

testsToRun=()

addTestIfPresent() {
	local candidate="$1"
	local existing

	[[ -f "${candidate}" ]] || return 0
	for existing in "${testsToRun[@]}"; do
		[[ "${existing}" == "${candidate}" ]] && return 0
	done

	testsToRun+=("${candidate}")
}

while IFS= read -r -d '' record; do
	status="${record:0:2}"
	path="${record:3}"

	case "${status}" in
		*R* | *C*)
			IFS= read -r -d ''
			;;
	esac

	case "${path}" in
		tests/*.test.ts | tests/*.spec.ts)
			addTestIfPresent "${path}"
			;;
		src/rules/*/*.ts)
			ruleName="${path#src/rules/*/}"
			addTestIfPresent "tests/${ruleName%.ts}.test.ts"
			;;
		src/index.ts)
			addTestIfPresent "tests/index.test.ts"
			;;
	esac
done < <(git status --porcelain=v1 -z --untracked-files=all)

[[ ${#testsToRun[@]} -eq 0 ]] && exit 0

node --run test:agent -- "${testsToRun[@]}"
