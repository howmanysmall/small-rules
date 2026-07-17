import { RuleIndex } from "@/components/rule-index";
import { createRuleIndexCategories } from "@/components/rule-index-data";
import { getRuleFactCategory } from "@/data/rule-facts";

import type React from "react";

import type { RuleCategoryKey } from "@/data/rule-manifest";

interface RuleCategoryPageProperties {
	readonly category: RuleCategoryKey;
}

export function RuleCategoryPage({ category: categoryKey }: RuleCategoryPageProperties): React.JSX.Element {
	const category = getRuleFactCategory(categoryKey);
	const categories = createRuleIndexCategories([category]);

	return (
		<>
			<p className="rule-category-summary">
				{category.description}
				{"Browse all "}
				{category.count} {category.count === 1 ? "rule" : "rules"}
				{" in this category."}
			</p>
			<RuleIndex categories={categories} mode="category" />
		</>
	);
}
