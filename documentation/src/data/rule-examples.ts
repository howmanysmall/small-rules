import { readdirSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { cwd } from "node:process";

import { extractRuleExamples } from "../utilities/extract-rule-examples";
import { formatRuleExampleAsync } from "../utilities/format-rule-example";
import { ruleManifest } from "./rule-manifest";

import type { RuleExample } from "../utilities/extract-rule-examples";
import type { RuleManifestEntry, RuleName } from "./rule-manifest";

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

		for (const example of extraction.examples) {
			examples.push(example);
		}
	}
}

const collator = new Intl.Collator();

function orderExamples(examples: ReadonlyArray<RuleExample>): Array<RuleExample> {
	return examples.toSorted(
		(left, right) => collator.compare(left.kind, right.kind) || collator.compare(left.id, right.id),
	);
}

async function formatRuleEntryAsync(
	entry: RuleManifestEntry,
): Promise<readonly [RuleName, ReadonlyArray<RuleExample>]> {
	const rawExamples = orderExamples(examplesByRuleName.get(entry.name) ?? []);
	const formattedExamples = await Promise.all(rawExamples.map(formatRuleExampleAsync));
	return [entry.name, formattedExamples];
}

async function loadRuleExamplesAsync(): Promise<ReadonlyMap<RuleName, ReadonlyArray<RuleExample>>> {
	const entryPromises = new Array<Promise<readonly [RuleName, ReadonlyArray<RuleExample>]>>();

	for (const category of ruleManifest.categories) {
		for (const entry of category.rules) {
			entryPromises.push(formatRuleEntryAsync(entry));
		}
	}

	const formattedEntries = await Promise.all(entryPromises);
	return new Map<RuleName, ReadonlyArray<RuleExample>>(formattedEntries);
}

// oxlint-disable-next-line antfu/no-top-level-await -- Formats extracted rule examples once at module load.
export const ruleExamples = await loadRuleExamplesAsync();
