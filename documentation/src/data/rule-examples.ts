import { readdirSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { cwd } from "node:process";

import { extractRuleExamples } from "../utilities/extract-rule-examples";
import { ruleManifest } from "./rule-manifest";

import type { RuleExample } from "../utilities/extract-rule-examples";
import type { RuleName } from "./rule-manifest";

const workingDirectory = cwd();
const repositoryRoot = nodePath.basename(workingDirectory) === "documentation" ? ".." : ".";
const RULES_DIRECTORY = "src/rules";
const rulesDirectory = nodePath.resolve(workingDirectory, repositoryRoot, RULES_DIRECTORY);

const testFileRelativePaths = readdirSync(rulesDirectory, { encoding: "utf8", recursive: true })
	.filter((relativePath) => relativePath.endsWith(".test.ts"))
	.toSorted();
const examplesByRuleName = new Map<string, Array<RuleExample>>();

for (const testFileRelativePath of testFileRelativePaths) {
	const relativePath = `${RULES_DIRECTORY}/${testFileRelativePath}`;
	const sourceText = readFileSync(nodePath.join(rulesDirectory, testFileRelativePath), "utf8");
	for (const extraction of extractRuleExamples(sourceText, relativePath)) {
		const examples = examplesByRuleName.get(extraction.ruleName) ?? new Array<RuleExample>();
		examplesByRuleName.set(extraction.ruleName, examples);

		for (const example of extraction.examples) examples.push(example);
	}
}

const collator = new Intl.Collator();

function orderExamples(examples: ReadonlyArray<RuleExample>): Array<RuleExample> {
	return examples.toSorted(
		(left, right) => collator.compare(left.kind, right.kind) || collator.compare(left.id, right.id),
	);
}

export const ruleExamples: ReadonlyMap<RuleName, ReadonlyArray<RuleExample>> = new Map<
	RuleName,
	ReadonlyArray<RuleExample>
>(
	ruleManifest.categories.flatMap((category) =>
		category.rules.map((entry) => [entry.name, orderExamples(examplesByRuleName.get(entry.name) ?? [])]),
	),
);
