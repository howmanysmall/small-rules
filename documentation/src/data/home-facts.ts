import { ruleCategories, totalCategories, totalRules } from "./rule-stats";

// Counts are derived from the rule sidebar definitions (the source of truth for
// documented rules) so they cannot drift out of sync with the rule list.
// `fixableRules` counts documented rules in `src/rules` that expose an oxlint
// code fix or fixer suggestion.
export const homeFacts = {
	categories: {
		general: ruleCategories.general.count,
		naming: ruleCategories.naming.count,
		react: ruleCategories.react.count,
		roblox: ruleCategories.roblox.count,
	},
	fixableRules: 27,
	totalCategories,
	totalRules,
} as const;
