import { siteBasePath } from "$utilities/site-base-path";

import type { ReactNode } from "react";

import type { RuleIndexCategory } from "./rule-index-data";

type RuleIndexRule = RuleIndexCategory["rules"][number];

export interface RuleIndexCardProperties {
	rule: RuleIndexRule;
	showCategory?: boolean | undefined;
}

interface RuleTrait {
	readonly className: string;
	readonly label: string;
	readonly title?: string | undefined;
}

function getRuleTypeTrait(type: RuleIndexRule["type"]): RuleTrait {
	return {
		className: `rule-index-card-trait rule-index-card-trait-${type}`,
		label: type === "problem" ? "Problem" : "Suggestion",
	};
}

function getRuleFreshnessTrait(rule: RuleIndexRule): RuleTrait | undefined {
	if (rule.isNew === true) {
		return {
			className: "rule-index-card-trait rule-index-card-trait-new",
			label: "New",
			title: rule.addedIn === undefined ? "Not yet in a release" : `Added in ${rule.addedIn}`,
		};
	}

	if (rule.isUpdated === true) {
		return {
			className: "rule-index-card-trait rule-index-card-trait-updated",
			label: "Updated",
			title:
				rule.updatedIn === undefined
					? "Recently updated, not yet in a release"
					: `Updated in ${rule.updatedIn}`,
		};
	}

	return undefined;
}

function getRuleFixabilityTrait(rule: RuleIndexRule): RuleTrait | undefined {
	if (rule.fixability === undefined) return undefined;
	return { className: "rule-index-card-trait rule-index-card-trait-fixable", label: rule.fixability };
}

function getRuleTraits(rule: RuleIndexRule): ReadonlyArray<RuleTrait> {
	const traits = [getRuleTypeTrait(rule.type)];
	const freshness = getRuleFreshnessTrait(rule);
	const fixability = getRuleFixabilityTrait(rule);
	if (freshness !== undefined) traits.push(freshness);
	if (fixability !== undefined) traits.push(fixability);
	return traits;
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
				{getRuleTraits(rule).map((trait) => (
					<li key={trait.className} className={trait.className} title={trait.title}>
						{trait.label}
					</li>
				))}
			</ul>
		</a>
	);
}
