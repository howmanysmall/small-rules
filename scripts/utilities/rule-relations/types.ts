import { isNumber } from "@small-rules/arktype-utilities";
import { type } from "arktype";

import type { RuleName } from "$data/rule-manifest";
import type { RuleRelationKind } from "$data/rule-relations";

export interface RuleCardExample {
	readonly code: string;
	readonly kind: "invalid" | "valid";
	readonly title: string;
}

export interface RuleCard {
	readonly name: RuleName;
	readonly category: string;
	readonly description: string;
	readonly examples: ReadonlyArray<RuleCardExample>;
	readonly messages: ReadonlyArray<string>;
	readonly options: string;
	readonly rationale: string;
	readonly sharedUtilities: ReadonlyArray<string>;
	readonly title: string;
}

function defineJudgmentDimensions<const TDimensions extends ReadonlyArray<string>>(
	dimensions: TDimensions,
): TDimensions {
	return dimensions;
}

export const enum JudgmentDimension {
	Duplicates = "duplicates",
	Exists = "exists",
	Replaces = "replaces",
	Requires = "requires",
}
const allJudgmentDimensions = [
	JudgmentDimension.Duplicates,
	JudgmentDimension.Exists,
	JudgmentDimension.Replaces,
	JudgmentDimension.Requires,
];
export const isJudgmentDimension = type.enumerated(...allJudgmentDimensions);

export const judgmentDimensions = defineJudgmentDimensions(allJudgmentDimensions);

export const isPairJudgments = type({
	[JudgmentDimension.Duplicates]: isNumber,
	[JudgmentDimension.Exists]: isNumber,
	[JudgmentDimension.Replaces]: isNumber,
	[JudgmentDimension.Requires]: isNumber,
}).readonly();
export type PairJudgments = typeof isPairJudgments.infer;

export interface JudgmentThresholds {
	readonly accept: number;
	readonly review: number;
}

export interface NoulQuestion {
	readonly criteria: { readonly false: string; readonly true: string };
	readonly instructions: { readonly candidate: RuleCard; readonly question: string };
	readonly type: "noul";
}

export const isNoulAnswer = type({
	"+": "reject",
	noul: isNumber,
	type: "'noul'",
}).readonly();
export type NoulAnswer = typeof isNoulAnswer.infer;

interface DecideOptions {
	readonly model: string;
	readonly questions: Readonly<Record<string, NoulQuestion>>;
	readonly state: RuleCard;
}

export interface DecisionTransport {
	readonly decide: (options: DecideOptions) => Promise<Readonly<Record<string, NoulAnswer>>>;
}

export interface UnorderedRulePair {
	readonly left: RuleName;
	readonly right: RuleName;
}

export interface RelationDraft {
	readonly from: RuleName;
	readonly kind: RuleRelationKind;
	readonly to: RuleName;
}

export interface ScoredRelation {
	readonly relation: RelationDraft;
	readonly strength: number;
}

export interface ReasonWriter {
	readonly writeReason: (options: {
		readonly left: RuleCard;
		readonly relation: RelationDraft;
		readonly right: RuleCard;
	}) => Promise<string>;
}

export interface RelationProgress {
	readonly cached: number;
	readonly completed: number;
	readonly phase: "judgments" | "reasons";
	readonly total: number;
}

export interface RelationUsage {
	readonly cost?: number | undefined;
	readonly inputTokens?: number | undefined;
	readonly outputTokens?: number | undefined;
	readonly phase: RelationProgress["phase"];
	readonly totalTokens?: number | undefined;
}

export interface ReviewFinding {
	readonly concern: string;
	readonly left: RuleName;
	readonly right: RuleName;
	readonly strength: number;
}

export type RelationResolution =
	| { readonly concern: string; readonly strength: number; readonly type: "review" }
	| { readonly relation: RelationDraft; readonly strength: number; readonly type: "relation" }
	| { readonly type: "none" };

export function getJudgmentKey(source: string, candidate: string): string {
	return `${source}->${candidate}`;
}

export function getPairKey(from: string, to: string): string {
	return [from, to].toSorted().join(":");
}

export function compareStrings(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
