import smallRules from "$small-rules";

import { formatRuleTitle, getRuleCategoryPath, getRulePath, ruleManifest } from "./rule-manifest";
import { getRuleOptionsDocumentation } from "./rule-options";

import type { RuleCategoryKey, RuleCategoryManifest, RuleManifestEntry, RuleName } from "./rule-manifest";
import type { RuleOptionsDocumentation } from "./rule-options";

type RuleMeta = NonNullable<(typeof smallRules.rules)[RuleName]["meta"]>;

export interface RuleFacts {
	readonly name: RuleName;
	readonly category: RuleCategoryKey;
	readonly categoryLabel: string;
	readonly description: string;
	readonly fixable: RuleMeta["fixable"];
	readonly hasSuggestions: RuleMeta["hasSuggestions"];
	readonly messages: RuleMeta["messages"];
	readonly options: RuleOptionsDocumentation;
	readonly path: string;
	readonly title: string;
	readonly type: RuleMeta["type"];
}

export interface RuleFactCategory {
	readonly key: RuleCategoryKey;
	readonly count: number;
	readonly description: string;
	readonly label: string;
	readonly path: string;
	readonly rules: ReadonlyArray<RuleFacts>;
}

export interface RuleFactCounts {
	readonly autofixableRules: number;
	readonly fixableRules: number;
	readonly suggestionRules: number;
	readonly totalCategories: number;
	readonly totalRules: number;
}

function getRuleMeta(ruleName: RuleName): RuleMeta {
	const { meta } = smallRules.rules[ruleName];
	if (meta !== undefined) return meta;

	throw new Error(`Rule "${ruleName}" is missing metadata.`);
}

function createRuleFacts(category: RuleCategoryManifest, entry: RuleManifestEntry): RuleFacts {
	const meta = getRuleMeta(entry.name);

	return {
		name: entry.name,
		category: category.key,
		categoryLabel: category.label,
		description: meta.docs?.description ?? "<MISSING-DESCRIPTION>",
		fixable: meta.fixable,
		hasSuggestions: meta.hasSuggestions,
		messages: meta.messages,
		options: getRuleOptionsDocumentation(entry.name),
		path: getRulePath(category, entry.name),
		title: formatRuleTitle(entry.name),
		type: meta.type,
	};
}

function createRuleFactEntry(category: RuleCategoryManifest, entry: RuleManifestEntry): readonly [RuleName, RuleFacts] {
	return [entry.name, createRuleFacts(category, entry)];
}

function createRuleFactEntries(): ReadonlyArray<readonly [RuleName, RuleFacts]> {
	return ruleManifest.categories.flatMap((category) =>
		category.rules.map((entry) => createRuleFactEntry(category, entry)),
	);
}

const ruleFacts: ReadonlyMap<RuleName, RuleFacts> = new Map(createRuleFactEntries());

export function getRuleFacts(ruleName: RuleName): RuleFacts {
	const facts = ruleFacts.get(ruleName);
	if (facts !== undefined) return facts;

	throw new Error(`Rule "${ruleName}" is missing from the rule manifest.`);
}

export function getRuleEntry(ruleName: RuleName): RuleManifestEntry | undefined {
	let ruleManifestEntry: RuleManifestEntry | undefined;

	for (const category of ruleManifest.categories) {
		for (const candidate of category.rules) {
			if (candidate.name === ruleName) {
				ruleManifestEntry = candidate;
				break;
			}
		}

		if (ruleManifestEntry !== undefined) break;
	}

	return ruleManifestEntry;
}

function createRuleFactCategory(category: RuleCategoryManifest): RuleFactCategory {
	const rules = category.rules.map((entry) => getRuleFacts(entry.name));

	return {
		key: category.key,
		count: rules.length,
		description: category.description,
		label: category.label,
		path: getRuleCategoryPath(category),
		rules,
	};
}

function createRuleFactCategoryEntry(category: RuleCategoryManifest): readonly [RuleCategoryKey, RuleFactCategory] {
	return [category.key, createRuleFactCategory(category)];
}

export const ruleFactCategories: ReadonlyMap<RuleCategoryKey, RuleFactCategory> = new Map(
	ruleManifest.categories.map(createRuleFactCategoryEntry),
);

export function getRuleFactCategory(categoryKey: RuleCategoryKey): RuleFactCategory {
	const category = ruleFactCategories.get(categoryKey);
	if (category !== undefined) return category;

	throw new Error(`Rule category "${categoryKey}" is missing from the rule manifest.`);
}

function deriveRuleFactCounts(): RuleFactCounts {
	let autofixableRules = 0;
	let suggestionRules = 0;
	let fixableRules = 0;

	for (const facts of ruleFacts.values()) {
		const hasAutomaticFix = facts.fixable !== undefined;
		const hasSuggestions = facts.hasSuggestions === true;

		if (hasAutomaticFix) autofixableRules += 1;
		if (hasSuggestions) suggestionRules += 1;
		if (hasAutomaticFix || hasSuggestions) fixableRules += 1;
	}

	return {
		autofixableRules,
		fixableRules,
		suggestionRules,
		totalCategories: ruleFactCategories.size,
		totalRules: ruleFacts.size,
	};
}

export const ruleFactCounts = deriveRuleFactCounts();
