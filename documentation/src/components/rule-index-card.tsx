import { siteBasePath } from "$utilities/site-base-path";

import type { ReactNode } from "react";

import type { RuleIndexCategory } from "./rule-index-data";

type RuleIndexRule = RuleIndexCategory["rules"][number];

export interface RuleIndexCardProperties {
	rule: RuleIndexRule;
	showCategory?: boolean | undefined;
}

export function RuleIndexCard({ rule, showCategory }: Readonly<RuleIndexCardProperties>): ReactNode {
	return (
		<a
			className="rule-index-card"
			data-rule-card=""
			data-rule-category={rule.category}
			href={`${siteBasePath}${rule.path}/`}
		>
			<div className="rule-index-card-heading">
				<h2>{rule.title}</h2>
				{showCategory === true && <span className="rule-index-card-category">{rule.categoryLabel}</span>}
			</div>
			<code>{rule.name}</code>
			<p>{rule.description}</p>
			<ul aria-label="Rule characteristics">
				<li
					className={`rule-index-card-trait rule-index-card-trait-${rule.type === "problem" ? "problem" : "suggestion"}`}
				>
					{rule.type === "problem" ? "Problem" : "Suggestion"}
				</li>
				{rule.isNew === true && (
					<li
						className="rule-index-card-trait rule-index-card-trait-new"
						title={rule.addedIn === undefined ? "Not yet in a release" : `Added in ${rule.addedIn}`}
					>
						{"New"}
					</li>
				)}
				{rule.isNew !== true && rule.isUpdated === true && (
					<li
						className="rule-index-card-trait rule-index-card-trait-updated"
						title={
							rule.updatedIn === undefined
								? "Recently updated, not yet in a release"
								: `Updated in ${rule.updatedIn}`
						}
					>
						{"Updated"}
					</li>
				)}
				{rule.fixability === undefined ? undefined : (
					<li className="rule-index-card-trait rule-index-card-trait-fixable">{rule.fixability}</li>
				)}
			</ul>
		</a>
	);
}
