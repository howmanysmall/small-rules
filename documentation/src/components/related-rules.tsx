import { getRuleFacts } from "$data/rule-facts";
import { getRelatedRules, isDirectedKind } from "$data/rule-relations";
import { siteBasePath } from "$utilities/site-base-path";

import { RelationReason } from "./relation-reason";

import type { ReactNode } from "react";

import type { RuleFacts } from "$data/rule-facts";
import type { RuleName } from "$data/rule-manifest";
import type { DirectedRuleRelationKind, RuleRelation, RuleRelationKind } from "$data/rule-relations";

interface RelatedRulesProperties {
	rule: RuleName;
}

interface RelatedRuleLinkProperties {
	counterpart: RuleFacts;
	relation: RuleRelation;
	viewedFrom: RuleName;
}

function getCounterpartName(relation: RuleRelation, ruleName: RuleName): RuleName {
	return relation.from === ruleName ? relation.to : relation.from;
}

const forwardRelationLabels = {
	"depends-on": "Depends on",
	overlaps: "Overlaps",
	related: "Related",
	supersedes: "Supersedes",
} satisfies Record<RuleRelationKind, string>;

const inverseRelationLabels = {
	"depends-on": "Depended on by",
	supersedes: "Superseded by",
} satisfies Record<DirectedRuleRelationKind, string>;

const relationKindOrder = {
	"depends-on": 1,
	overlaps: 2,
	related: 3,
	supersedes: 0,
} satisfies Record<RuleRelationKind, number>;

const collator = new Intl.Collator();

function compareRelatedRules(left: RelatedRuleLinkProperties, right: RelatedRuleLinkProperties): number {
	return (
		relationKindOrder[left.relation.kind] - relationKindOrder[right.relation.kind] ||
		collator.compare(left.counterpart.title, right.counterpart.title)
	);
}

function formatRelationKind(relation: RuleRelation, viewedFrom: RuleName): string {
	if (isDirectedKind(relation.kind) && relation.from !== viewedFrom) return inverseRelationLabels[relation.kind];
	return forwardRelationLabels[relation.kind];
}

// biome-ignore lint/correctness/useUniqueElementIds: preserve
const relatedRulesHeading = <h2 id="related-rules">{"Related Rules"}</h2>;

function renderRelatedRule({ counterpart, relation, viewedFrom }: RelatedRuleLinkProperties): ReactNode {
	return (
		<a key={counterpart.name} className="related-rule" href={`${siteBasePath}${counterpart.path}/`}>
			<span className="related-rule-kind">{formatRelationKind(relation, viewedFrom)}</span>
			<strong className="related-rule-title">{counterpart.title}</strong>
			<span className="related-rule-reason">
				<RelationReason reason={relation.reason} />
			</span>
		</a>
	);
}

export function RelatedRules({ rule }: Readonly<RelatedRulesProperties>): ReactNode {
	const relations = getRelatedRules(rule)
		.map((relation) => ({
			counterpart: getRuleFacts(getCounterpartName(relation, rule)),
			relation,
			viewedFrom: rule,
		}))
		.toSorted(compareRelatedRules);

	if (relations.length === 0) return undefined;
	const relatedRuleLinks = relations.map(renderRelatedRule);

	return (
		<section aria-labelledby="related-rules">
			{relatedRulesHeading}
			<div className="related-rules">{relatedRuleLinks}</div>
		</section>
	);
}
