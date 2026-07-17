import { siteBasePath } from "@/utilities/site-base-path";

import { Icon } from "./icon";

import type React from "react";

import type { RuleCategoryKey } from "@/data/rule-manifest";

interface CategoryCardProperties {
	readonly category: RuleCategoryKey;
	readonly count: number;
	readonly description: string;
	readonly label: string;
}

const cardGlow = <span aria-hidden="true" className="category-card-glow" />;

export function CategoryCard({ category, count, description, label }: CategoryCardProperties): React.JSX.Element {
	return (
		<a className="category-card" data-category={category} href={`${siteBasePath}rules/${category}/`}>
			{cardGlow}
			<div className="category-card-icon">
				<Icon name={category} size={22} />
			</div>
			<div className="category-card-body">
				<div className="category-card-head">
					<h3 className="category-card-title">{label}</h3>
					<span className="category-card-count">{count}</span>
				</div>
				<p className="category-card-desc">{description}</p>
				<span className="category-card-cta">
					{"Browse rules"}
					<Icon name="arrow-right" size={14} />
				</span>
			</div>
		</a>
	);
}
