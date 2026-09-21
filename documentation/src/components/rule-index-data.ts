import { getRuleNewness } from "$data/rule-newness";

import type { Writable } from "type-fest";

import type { RuleFactCategory } from "$data/rule-facts";
import type { RuleNewness } from "$data/rule-newness";

interface Rule {
	readonly name: string;
	readonly addedIn?: string | undefined;
	readonly category: RuleFactCategory["key"];
	readonly categoryLabel: string;
	readonly description: string;
	readonly fixability?: string;
	readonly isNew?: boolean | undefined;
	readonly isUpdated?: boolean | undefined;
	readonly path: string;
	readonly title: string;
	readonly type: RuleFactCategory["rules"][number]["type"];
	readonly updatedIn?: string | undefined;
}

export interface RuleIndexCategory {
	readonly key: RuleFactCategory["key"];
	readonly label: string;
	readonly rules: ReadonlyArray<Rule>;
}

export function createRuleIndexCategories(
	categories: Iterable<RuleFactCategory>,
	newness: ReadonlyMap<string, RuleNewness> = getRuleNewness(),
): ReadonlyArray<RuleIndexCategory> {
	return Array.from(categories, (category): RuleIndexCategory => ({
		key: category.key,
		label: category.label,
		rules: category.rules.map((rule) => createRuleIndexRule(rule, newness.get(rule.name))),
	}));
}

function createRuleIndexRule(rule: RuleFactCategory["rules"][number], newness: RuleNewness | undefined): Rule {
	const newRule: Writable<Rule> = {
		name: rule.name,
		category: rule.category,
		categoryLabel: rule.categoryLabel,
		description: rule.description,
		path: rule.path,
		title: rule.title,
		type: rule.type,
	};

	addFixability(newRule, getFixability(rule));
	addFreshness(newRule, newness);
	return newRule;
}

function addFixability(rule: Writable<Rule>, fixability: string | undefined): void {
	if (fixability !== undefined) rule.fixability = fixability;
}

function addFreshness(rule: Writable<Rule>, newness: RuleNewness | undefined): void {
	if (newness?.isNew === true) {
		rule.addedIn = newness.addedIn;
		rule.isNew = true;
		return;
	}

	if (newness?.isUpdated === true) {
		rule.isUpdated = true;
		rule.updatedIn = newness.updatedIn;
	}
}

function getFixability(rule: RuleFactCategory["rules"][number]): string | undefined {
	if (rule.fixable === undefined) {
		if (rule.hasSuggestions === true) return "Editor suggestions";
	} else {
		return rule.hasSuggestions === true ? "Automatic fix and editor suggestions" : "Automatic fix";
	}

	return undefined;
}
