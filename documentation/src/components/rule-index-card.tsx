import { siteBasePath } from "@/utilities/site-base-path";

import type { ReactElement } from "react";

import type { RuleIndexCategory } from "./rule-index-data";

type RuleIndexRule = RuleIndexCategory["rules"][number];

export interface RuleIndexCardProperties {
	readonly rule: RuleIndexRule;
}

export function RuleIndexCard({ rule }: RuleIndexCardProperties): ReactElement {
	return (
		<a
			className="rule-index-card"
			data-rule-card=""
			data-rule-category={rule.category}
			href={`${siteBasePath}${rule.path}/`}
		>
			<div className="rule-index-card-heading">
				<h2>{rule.title}</h2>
				<span className="rule-index-card-category">{rule.categoryLabel}</span>
			</div>
			<code>{rule.name}</code>
			<p>{rule.description}</p>
			<ul aria-label="Rule characteristics">
				<li className="rule-index-card-trait">{rule.type === "problem" ? "Problem" : "Suggestion"}</li>
				{rule.fixability === undefined ? undefined : (
					<li className="rule-index-card-trait">{rule.fixability}</li>
				)}
			</ul>
		</a>
	);
}
