import { siteBasePath } from "$utilities/site-base-path";

import type { ReactNode } from "react";

import type { RuleIndexCategory } from "./rule-index-data";

type RuleIndexRule = RuleIndexCategory["rules"][number];

export interface RuleIndexCardProperties {
	rule: RuleIndexRule;
}

export function RuleIndexCard({ rule }: Readonly<RuleIndexCardProperties>): ReactNode {
	const showNew = rule.isNew === true;
	const showUpdated = !showNew && rule.isUpdated === true;

	return (
		<a
			className="rule-index-card"
			data-rule-card=""
			data-rule-category={rule.category}
			href={`${siteBasePath}${rule.path}/`}
		>
			<div className="rule-index-card-heading">
				<h2>{rule.title}</h2>
				{showNew && (
					<span
						className="rule-index-card-new"
						title={rule.addedIn === undefined ? "Not yet in a release" : `Added in ${rule.addedIn}`}
					>
						{"New"}
					</span>
				)}
				{showUpdated && (
					<span
						className="rule-index-card-updated"
						title={
							rule.updatedIn === undefined
								? "Recently updated, not yet in a release"
								: `Updated in ${rule.updatedIn}`
						}
					>
						{"Updated"}
					</span>
				)}
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
