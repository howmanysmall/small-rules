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
// Mirror the Vitest include while skipping support directories that never
// document rules.
const IGNORED_TEST_ROOTS = new Set(["do-not-sync-ever", "fixtures"]);

function isCollectedTestFile(relativePath: string): boolean {
	if (!relativePath.endsWith(".test.ts")) return false;
	const [root] = relativePath.split("/");
	return root !== undefined && !IGNORED_TEST_ROOTS.has(root);
}

const testFileRelativePaths = readdirSync(testsDirectory, { encoding: "utf8", recursive: true })
	.filter(isCollectedTestFile)
	.toSorted();
const examplesByRuleName = new Map<string, Array<RuleExample>>();

for (const testFileRelativePath of testFileRelativePaths) {
	const relativePath = `tests/${testFileRelativePath}`;
	const sourceText = readFileSync(nodePath.join(testsDirectory, testFileRelativePath), "utf8");
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
