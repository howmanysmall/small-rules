#!/usr/bin/env bash

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

ecmaFiles=()
shellFiles=()
tomlFiles=()
markdownFiles=()
actionlintFiles=()
pinactFiles=()
zizmorFiles=()
wasWorkspaceChanged=false

isShellFile() {
	case "$1" in
	*.sh | *.bash | *.ksh | *.dash | *.zsh)
		return 0
		;;
	esac

	IFS= read -r firstLine <"$1" || true
	case "${firstLine}" in
	'#!'*'/bash'* | '#!'*'/sh'* | '#!'*'/zsh'* | '#!'*'/ksh'* | '#!'*'/dash'*)
		return 0
		;;
	*)
		return 1
		;;
	esac
}

while IFS= read -r -d '' record; do
	status="${record:0:2}"
	path="${record:3}"

	case "${status}" in
	*R* | *C*)
		IFS= read -r -d '' _source_path
		;;
	esac

	[[ -z "${path}" || ! -f "${path}" ]] && continue

	case "${path}" in
	*.js | *.jsx | *.ts | *.tsx | *.mjs | *.cjs | *.mts | *.cts | *.astro)
		ecmaFiles+=("${path}")
		;;
	*.toml)
		tomlFiles+=("${path}")
		;;
	*.md | *.markdown | *.mdx)
		markdownFiles+=("${path}")
		;;
	.github/workflows/*.yml | .github/workflows/*.yaml | .github/actions/*/action.yml | .github/actions/*/action.yaml)
		actionlintFiles+=("${path}")
		pinactFiles+=("${path}")
		zizmorFiles+=("${path}")
		;;
	.github/dependabot.yml)
		zizmorFiles+=("${path}")
		;;
	package.json | pnpm-workspace.yaml)
		wasWorkspaceChanged=true
		;;
	esac

	if isShellFile "${path}"; then
		shellFiles+=("${path}")
	fi
done < <(git status --porcelain=v1 -z --untracked-files=all)

if [[ ${#ecmaFiles[@]} -gt 0 ]]; then
	node --run format -- "${ecmaFiles[@]}"
	node --run oxlint -- --fix --no-error-on-unmatched-pattern --format agent "${ecmaFiles[@]}"
	node --run lint:agent -- "${ecmaFiles[@]}"
fi

if [[ ${#shellFiles[@]} -gt 0 ]]; then
	shfmt -w "${shellFiles[@]}"
	shellcheck "${shellFiles[@]}"
fi

if [[ ${#tomlFiles[@]} -gt 0 ]]; then
	for tomlFile in "${tomlFiles[@]}"; do
		if [[ "${tomlFile}" == .codex/config.toml ]]; then
			tombi format --check "${tomlFile}"
		else
			tombi format "${tomlFile}"
		fi
	done
	tombi lint "${tomlFiles[@]}"
fi

if [[ ${#markdownFiles[@]} -gt 0 ]]; then
	rumdl check --fix "${markdownFiles[@]}"
	rumdl fmt "${markdownFiles[@]}"
fi

if [[ ${#actionlintFiles[@]} -gt 0 ]]; then
	actionlint "${actionlintFiles[@]}"
	pinact run "${pinactFiles[@]}"
fi

if [[ ${#zizmorFiles[@]} -gt 0 ]]; then
	zizmor --fix --offline "${zizmorFiles[@]}"
fi

if [[ "${wasWorkspaceChanged}" == true ]]; then
	sherif --fix --no-install
fi
