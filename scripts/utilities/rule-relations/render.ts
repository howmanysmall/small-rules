import { isRuleName, isRuleRelationKind } from "$data/rule-relations";

import { relationGeneratorPath } from "./constants";
import { compareStrings, isPairJudgments } from "./types";

import type { RuleName } from "$data/rule-manifest";
import type { RuleRelationKind } from "$data/rule-relations";

import type { PairJudgments } from "./types";

export interface RelationEvidence {
	readonly backward: PairJudgments;
	readonly forward: PairJudgments;
	readonly strength: number;
}

export interface GeneratedEdge {
	readonly evidence?: RelationEvidence | undefined;
	readonly from: RuleName;
	readonly kind: RuleRelationKind;
	readonly reason: string;
	readonly to: RuleName;
}

function isRelationEvidence(value: unknown): value is RelationEvidence {
	return (
		typeof value === "object" &&
		value !== null &&
		"backward" in value &&
		isPairJudgments.allows(value.backward) &&
		"forward" in value &&
		isPairJudgments.allows(value.forward) &&
		"strength" in value &&
		typeof value.strength === "number"
	);
}

export function isGeneratedEdge(value: unknown): value is GeneratedEdge {
	if (typeof value !== "object" || value === null) return false;
	if (!("from" in value) || typeof value.from !== "string" || !isRuleName(value.from)) return false;
	if (!("to" in value) || typeof value.to !== "string" || !isRuleName(value.to)) return false;
	if (!("kind" in value) || typeof value.kind !== "string" || !isRuleRelationKind(value.kind)) return false;
	if (!("reason" in value) || typeof value.reason !== "string") return false;
	return !("evidence" in value) || value.evidence === undefined || isRelationEvidence(value.evidence);
}

export interface RelationModels {
	readonly decisions: string;
	readonly reasons: string;
}

export interface RelationDocument {
	readonly edges: ReadonlyArray<GeneratedEdge>;
	readonly generator: string;
	readonly models: RelationModels;
}

interface DocumentOptions {
	readonly edges: ReadonlyArray<GeneratedEdge>;
	readonly models: RelationModels;
}
export function createRelationDocument(options: DocumentOptions): RelationDocument {
	const edges = options.edges.toSorted(
		(left, right) =>
			compareStrings(left.from, right.from) ||
			compareStrings(left.to, right.to) ||
			compareStrings(left.kind, right.kind),
	);

	return { edges, generator: relationGeneratorPath, models: options.models };
}

export function renderRelationDocument(options: DocumentOptions): string {
	return `${JSON.stringify(createRelationDocument(options), undefined, "\t")}\n`;
}
