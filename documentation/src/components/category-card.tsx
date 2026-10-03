import { siteBasePath } from "$utilities/site-base-path";

import type { ReactNode } from "react";

import type { RuleCategoryKey } from "$data/rule-manifest";

interface CategoryCardProperties {
	category: RuleCategoryKey;
	count: number;
	description: string;
	label: string;
}

export function CategoryCard({ category, count, description, label }: Readonly<CategoryCardProperties>): ReactNode {
	return (
		<a className="category-card" data-category={category} href={`${siteBasePath}rules/${category}/`}>
			<div className="category-card-head">
				<h3 className="category-card-title">{label}</h3>
				<span className="category-card-count">{count}</span>
			</div>
			<p className="category-card-desc">{description}</p>
		</a>
	);
}
