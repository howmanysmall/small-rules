import { getRuleNewness } from "$data/rule-newness";

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
	readonly path: string;
	readonly title: string;
	readonly type: RuleFactCategory["rules"][number]["type"];
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
		rules: category.rules.map((rule) => {
			let fixability: string | undefined;
			if (rule.fixable === undefined) {
				if (rule.hasSuggestions === true) fixability = "Editor suggestions";
			} else {
				fixability = rule.hasSuggestions === true ? "Automatic fix and editor suggestions" : "Automatic fix";
			}

			const ruleNewness = newness.get(rule.name);
			const isNew = ruleNewness?.isNew === true;
			const ruleDetails = {
				name: rule.name,
				category: rule.category,
				categoryLabel: rule.categoryLabel,
				description: rule.description,
				path: rule.path,
				title: rule.title,
				type: rule.type,
			};

			if (fixability === undefined && !isNew) return ruleDetails;

			type MutableRule = { -readonly [Key in keyof Rule]: Rule[Key] };
			const newRule: MutableRule = { ...ruleDetails };
			if (fixability !== undefined) newRule.fixability = fixability;
			if (isNew) {
				newRule.addedIn = ruleNewness.addedIn;
				newRule.isNew = true;
			}
			return newRule;
		}),
	}));
}
