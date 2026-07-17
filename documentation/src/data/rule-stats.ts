import { getRuleFactCategory } from "./rule-facts";

import type { RuleCategoryKey } from "./rule-manifest";

interface RuleCategoryStats {
	readonly count: number;
	readonly label: string;
	readonly slug: string;
}

function createRuleCategoryStats(categoryKey: RuleCategoryKey): RuleCategoryStats {
	const category = getRuleFactCategory(categoryKey);
	return { count: category.count, label: category.label, slug: category.path };
}

export const ruleCategories: Record<RuleCategoryKey, RuleCategoryStats> = {
	general: createRuleCategoryStats("general"),
	naming: createRuleCategoryStats("naming"),
	react: createRuleCategoryStats("react"),
	roblox: createRuleCategoryStats("roblox"),
};

export { totalCategories, totalRules } from "./rule-facts";
