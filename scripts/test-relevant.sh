#!/usr/bin/env bash

# Find modified files using git
files=$(git status --porcelain | awk '{print $2}')

# Initialize an array of test files to run
testsToRun=()

for file in $files; do
	if [[ "$file" =~ ^tests/([^/]+)\.test\.ts$ ]]; then
		testsToRun+=("$file")
	elif [[ "$file" =~ ^src/rules/([^/]+)\.ts$ ]]; then
		ruleName="${BASH_REMATCH[1]}"
		testFile="tests/${ruleName}.test.ts"
		if [ -f "$testFile" ]; then
			testsToRun+=("$testFile")
		fi
	else
		# If other source files changed (e.g., in utilities), run the full suite
		if [[ "$file" =~ ^src/utilities/.* || "$file" =~ ^src/types/.* || "$file" == "package.json" || "$file" == "vitest.config.ts" ]]; then
			echo "Non-rule changes detected in $file. Running full test suite..."
			node --run test:agent
			exit $?
		fi
	fi
done

# Deduplicate tests
mapfile -t uniqueTests < <(printf "%s\n" "${testsToRun[@]}" | sort -u)

if [ ${#uniqueTests[@]} -eq 0 ]; then
	echo "No relevant rule or test file changes detected. Skipping test execution."
	exit 0
fi

echo "Running tests for: ${uniqueTests[*]}"
node --run test:agent -- "${uniqueTests[@]}"
