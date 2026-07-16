#!/usr/bin/env bash

# Find modified files using git
mapfile -t files < <(git status --porcelain | awk '{print $2}')

# Initialize arrays for each group
ecmaFiles=()
shellFiles=()
tomlFiles=()
markdownFiles=()
workflowFiles=()
wasPackageChanged=false

for file in "${files[@]}"; do
	if [ ! -f "$file" ]; then
		continue
	fi

	if [[ "$file" =~ \.(js|jsx|ts|tsx|mjs|cjs|mts|cts|astro|mdx)$ ]]; then
		ecmaFiles+=("$file")
	elif [[ "$file" =~ \.sh$ ]]; then
		shellFiles+=("$file")
	elif [[ "$file" =~ \.toml$ ]]; then
		tomlFiles+=("$file")
	elif [[ "$file" =~ \.md$ ]]; then
		if [[ ! "$file" =~ ^\.agents/skills/ ]]; then
			markdownFiles+=("$file")
		fi
	elif [[ "$file" =~ ^\.github/workflows/.*\.(yml|yaml)$ ]]; then
		workflowFiles+=("$file")
	elif [[ "$file" == "package.json" || "$file" == "pnpm-workspace.yaml" || "$file" == "pnpm-lock.yaml" ]]; then
		wasPackageChanged=true
	fi
done

# 1. Format/Lint JS & TS files
if [ ${#ecmaFiles[@]} -gt 0 ]; then
	echo "Formatting/linting JS/TS: ${ecmaFiles[*]}"
	node --run format -- "${ecmaFiles[@]}"
fi

# 2. Format/Lint Shell scripts (shfmt, shellcheck)
if [ ${#shellFiles[@]} -gt 0 ]; then
	echo "Formatting/linting shell scripts: ${shellFiles[*]}"
	shfmt -w "${shellFiles[@]}"
	shellcheck "${shellFiles[@]}"
fi

# 3. Format/Lint TOML files (tombi)
if [ ${#tomlFiles[@]} -gt 0 ]; then
	echo "Formatting/linting TOML files: ${tomlFiles[*]}"
	for toml_file in "${tomlFiles[@]}"; do
		tombi format "$toml_file"
		tombi lint "$toml_file"
	done
fi

# 4. Format/Lint Markdown files (rumdl)
if [ ${#markdownFiles[@]} -gt 0 ]; then
	echo "Formatting/linting Markdown: ${markdownFiles[*]}"
	for md_file in "${markdownFiles[@]}"; do
		rumdl check --fix "$md_file"
		rumdl fmt "$md_file"
	done
fi

# 5. Lint Workflows (actionlint, zizmor, pinact)
if [ ${#workflowFiles[@]} -gt 0 ]; then
	echo "Linting workflows: ${workflowFiles[*]}"
	actionlint "${workflowFiles[@]}"
	zizmor "${workflowFiles[@]}"
	pinact run
fi

# 6. Monorepo consistency checks (sherif)
if [ "$wasPackageChanged" = true ]; then
	echo "Workspace files modified. Running sherif consistency check..."
	sherif --fix --no-install
fi
