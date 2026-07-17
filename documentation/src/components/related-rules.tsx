import { getRuleFacts } from "@/data/rule-facts";
import { getRelatedRules } from "@/data/rule-relations";
import { siteBasePath } from "@/utilities/site-base-path";

import type React from "react";

import type { RuleFacts } from "@/data/rule-facts";
import type { RuleName } from "@/data/rule-manifest";
import type { RuleRelation } from "@/data/rule-relations";

interface RelatedRulesProperties {
	readonly rule: RuleName;
}

interface RelatedRuleLinkProperties {
	readonly counterpart: RuleFacts;
	readonly relation: RuleRelation;
}

function getCounterpartName(relation: RuleRelation, ruleName: RuleName): RuleName {
	return relation.from === ruleName ? relation.to : relation.from;
}

function formatRelationKind(kind: string): string {
	return kind
		.split("-")
		.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
		.join(" ");
}

// biome-ignore lint/correctness/useUniqueElementIds: This preserves the existing public heading anchor and label target.
const relatedRulesHeading = <h2 id="related-rules">{"Related Rules"}</h2>;

function renderRelatedRule({ counterpart, relation }: RelatedRuleLinkProperties): React.JSX.Element {
	return (
		<a className="related-rule" href={`${siteBasePath}${counterpart.path}/`} key={counterpart.name}>
			<span className="related-rule-heading">
				<strong>{counterpart.title}</strong>
				<span className="related-rule-kind">{formatRelationKind(relation.kind)}</span>
			</span>
			<span>{relation.reason}</span>
		</a>
	);
}

export function RelatedRules({ rule }: RelatedRulesProperties): React.JSX.Element | undefined {
	const relations = getRelatedRules(rule).map((relation) => ({
		counterpart: getRuleFacts(getCounterpartName(relation, rule)),
		relation,
	}));

	if (relations.length === 0) return undefined;
	const relatedRuleLinks = relations.map(renderRelatedRule);

	return (
		<section aria-labelledby="related-rules">
			{relatedRulesHeading}
			<div className="related-rules">{relatedRuleLinks}</div>
		</section>
	);
}
