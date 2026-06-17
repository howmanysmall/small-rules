import { ruleCategoryDefinitions, ruleCategoryOrder } from "./rule-sidebar";

import type { RuleCategoryDefinition, RuleCategoryKey } from "./rule-sidebar";

export { ruleSidebarGroups } from "./rule-sidebar";

interface RuleCategoryStats {
	readonly count: number;
	readonly label: string;
	readonly slug: string;
}

function createRuleCategoryStats(def: RuleCategoryDefinition): RuleCategoryStats {
	return { count: def.rules.length, label: def.label, slug: def.slug };
}

export const ruleCategories: Record<RuleCategoryKey, RuleCategoryStats> = {
	general: createRuleCategoryStats(ruleCategoryDefinitions.general),
	naming: createRuleCategoryStats(ruleCategoryDefinitions.naming),
	react: createRuleCategoryStats(ruleCategoryDefinitions.react),
	roblox: createRuleCategoryStats(ruleCategoryDefinitions.roblox),
};

export const totalCategories = ruleCategoryOrder.length;
export const totalRules = ruleCategoryOrder.reduce((sum, cat) => sum + ruleCategories[cat].count, 0);
