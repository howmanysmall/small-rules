import { readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { extractRuleExamples } from "../utilities/extract-rule-examples";
import { ruleManifest } from "./rule-manifest";

import type { RuleExample } from "../utilities/extract-rule-examples";
import type { RuleName } from "./rule-manifest";

const workingDirectory = process.cwd();
const testsDirectory = resolve(workingDirectory, basename(workingDirectory) === "documentation" ? "../tests" : "tests");
const testFileNames = readdirSync(testsDirectory, { encoding: "utf8", withFileTypes: true })
	.filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
	.map((entry) => entry.name)
	.toSorted();
const examplesByRuleName = new Map<string, Array<RuleExample>>();

for (const testFileName of testFileNames) {
	const relativePath = `tests/${testFileName}`;
	const sourceText = readFileSync(join(testsDirectory, testFileName), "utf8");
	for (const extraction of extractRuleExamples(sourceText, relativePath)) {
		const examples = examplesByRuleName.get(extraction.ruleName) ?? new Array<RuleExample>();
		examplesByRuleName.set(extraction.ruleName, examples);
		examples.push(...extraction.examples);
	}
}

export const ruleExamples: ReadonlyMap<RuleName, ReadonlyArray<RuleExample>> = new Map<
	RuleName,
	ReadonlyArray<RuleExample>
>(
	ruleManifest.categories.flatMap((category) =>
		category.rules.map((entry) => [entry.name, orderExamples(examplesByRuleName.get(entry.name) ?? [])]),
	),
);

function orderExamples(examples: ReadonlyArray<RuleExample>): Array<RuleExample> {
	return examples.toSorted((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
}
