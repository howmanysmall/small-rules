import type { RuleFactCategory } from "@/data/rule-facts";

export interface RuleIndexCategory {
	readonly key: RuleFactCategory["key"];
	readonly label: string;
	readonly rules: ReadonlyArray<{
		readonly category: RuleFactCategory["key"];
		readonly categoryLabel: string;
		readonly description: string;
		readonly fixability?: string;
		readonly name: string;
		readonly path: string;
		readonly title: string;
		readonly type: RuleFactCategory["rules"][number]["type"];
	}>;
}

export function createRuleIndexCategories(categories: Iterable<RuleFactCategory>): ReadonlyArray<RuleIndexCategory> {
	return [...categories].map((category) => ({
		key: category.key,
		label: category.label,
		rules: category.rules.map((rule) => {
			let fixability: string | undefined;
			if (rule.fixable === undefined) {
				if (rule.hasSuggestions === true) fixability = "Editor suggestions";
			} else {
				fixability = rule.hasSuggestions === true ? "Automatic fix and editor suggestions" : "Automatic fix";
			}

			const ruleDetails = {
				category: rule.category,
				categoryLabel: rule.categoryLabel,
				description: rule.description,
				name: rule.name,
				path: rule.path,
				title: rule.title,
				type: rule.type,
			};

			return fixability === undefined ? ruleDetails : { ...ruleDetails, fixability };
		}),
	}));
}
