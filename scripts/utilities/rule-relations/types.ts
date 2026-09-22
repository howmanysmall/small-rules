import { type } from "arktype";

import type { RuleName } from "$data/rule-manifest";
import type { RuleRelationKind } from "$data/rule-relations";
import type { RuleExample } from "$utilities/extract-rule-examples";

export type RuleCardExample = Pick<
	RuleExample,
	"code" | "filename" | "kind" | "language" | "options" | "output" | "settings" | "title"
>;

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
	BackwardReplaces = "backwardReplaces",
	BackwardRequires = "backwardRequires",
	Duplicates = "duplicates",
	ForwardReplaces = "forwardReplaces",
	ForwardRequires = "forwardRequires",
}
const allJudgmentDimensions = [
	JudgmentDimension.Duplicates,
	JudgmentDimension.ForwardReplaces,
	JudgmentDimension.BackwardReplaces,
	JudgmentDimension.ForwardRequires,
	JudgmentDimension.BackwardRequires,
];
export const isJudgmentDimension = type.enumerated(...allJudgmentDimensions);

export const judgmentDimensions = defineJudgmentDimensions(allJudgmentDimensions);

const isProbability = type("0 <= number <= 1");
// Three values rounded to hundredths allow 3 × 0.005 rounding error.
const isAssessmentProbabilities = type({
	"0": isProbability,
	"1": isProbability,
	"2": isProbability,
	"+": "reject",
}).narrow((value) => Math.abs(value["0"] + value["1"] + value["2"] - 1) <= 0.015 + Number.EPSILON);

export const isScoreAnswer = type({
	"+": "delete",
	"confidence?": isProbability,
	probabilities: isAssessmentProbabilities,
	score: "0 <= number <= 2",
	type: "'score'",
}).readonly();
export type ScoreAnswer = typeof isScoreAnswer.infer;

export const isPairJudgments = type({
	"+": "reject",
	assessment: isScoreAnswer,
	[JudgmentDimension.BackwardReplaces]: isProbability,
	[JudgmentDimension.BackwardRequires]: isProbability,
	[JudgmentDimension.Duplicates]: isProbability,
	[JudgmentDimension.ForwardReplaces]: isProbability,
	[JudgmentDimension.ForwardRequires]: isProbability,
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

export interface ScoreQuestion {
	readonly criteria: ReadonlyArray<string>;
	readonly instructions: { readonly candidate: RuleCard; readonly question: string };
	readonly type: "score";
}

export type DecisionQuestion = NoulQuestion | ScoreQuestion;

export const isNoulAnswer = type({
	"+": "reject",
	noul: isProbability,
	type: "'noul'",
}).readonly();
export type NoulAnswer = typeof isNoulAnswer.infer;
export type DecisionAnswer = NoulAnswer | ScoreAnswer;

interface DecideOptions {
	readonly model: string;
	readonly questions: Readonly<Record<string, DecisionQuestion>>;
	readonly state: RuleCard;
}

export interface DecisionTransport {
	readonly decide: (options: DecideOptions) => Promise<Readonly<Record<string, DecisionAnswer>>>;
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

export function getPairKey(from: string, to: string): string {
	return [from, to].toSorted().join(":");
}

export function compareStrings(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
