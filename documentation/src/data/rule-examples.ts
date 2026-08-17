import { readdirSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { cwd } from "node:process";

import { extractRuleExamples } from "../utilities/extract-rule-examples";
import { ruleManifest } from "./rule-manifest";

import type { RuleExample } from "../utilities/extract-rule-examples";
import type { RuleName } from "./rule-manifest";

const workingDirectory = cwd();
const testsDirectory = nodePath.resolve(
	workingDirectory,
	nodePath.basename(workingDirectory) === "documentation" ? "../tests" : "tests",
);
// oxlint-disable-next-line react-doctor/js-combine-iterations -- called once.
const testFileNames = readdirSync(testsDirectory, { encoding: "utf8", withFileTypes: true })
	.filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
	.map((entry) => entry.name)
	.toSorted();
const examplesByRuleName = new Map<string, Array<RuleExample>>();

for (const testFileName of testFileNames) {
	const relativePath = `tests/${testFileName}`;
	const sourceText = readFileSync(nodePath.join(testsDirectory, testFileName), "utf8");
	for (const extraction of extractRuleExamples(sourceText, relativePath)) {
		const examples = examplesByRuleName.get(extraction.ruleName) ?? new Array<RuleExample>();
		examplesByRuleName.set(extraction.ruleName, examples);
		for (const example of extraction.examples) examples.push(example);
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

const collator = new Intl.Collator();

function orderExamples(examples: ReadonlyArray<RuleExample>): Array<RuleExample> {
	return examples.toSorted(
		(left, right) => collator.compare(left.kind, right.kind) || collator.compare(left.id, right.id),
	);
}
