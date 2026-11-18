import { RuleIndex } from "$components/rule-index";
import { createRuleIndexCategories } from "$components/rule-index-data";
import { getRuleFactCategory } from "$data/rule-facts";

import type { ReactNode } from "react";

import type { RuleCategoryKey } from "$data/rule-manifest";

interface RuleCategoryPageProperties {
	category: RuleCategoryKey;
}

export function RuleCategoryPage({ category }: Readonly<RuleCategoryPageProperties>): ReactNode {
	const factCategory = getRuleFactCategory(category);
	const categories = createRuleIndexCategories([factCategory]);

	return (
		<>
			<p className="rule-category-summary">
				{factCategory.description} {"Browse all "}
				{factCategory.count} {factCategory.count === 1 ? "rule" : "rules"}
				{" in this category."}
			</p>
			<RuleIndex categories={categories} mode="category" />
		</>
	);
}
