import { isDirectedKind } from "$data/rule-relations";

import { compareRelationBaseline } from "./evaluation";
import { compareStrings, getPairKey } from "./types";

import type { RuleName } from "$data/rule-manifest";
import type { RuleRelation, RuleRelationPair } from "$data/rule-relations";

import type { RelationBaselineComparison, RelationIdentity } from "./evaluation";
import type { GeneratedEdge } from "./render";
import type { RegenerationResult } from "./run";
import type { PairJudgments, RelationResolution, ReviewFinding, RuleCard, ScoredRelation } from "./types";

interface ReviewOptions {
	readonly cards: ReadonlyMap<RuleName, RuleCard>;
	readonly denylist: ReadonlyArray<RuleRelationPair>;
	readonly pins: ReadonlyArray<RuleRelation>;
	readonly previous: ReadonlyArray<GeneratedEdge>;
	readonly result: RegenerationResult;
}

interface ReviewedExpectation {
	readonly expected: "unrelated" | RelationIdentity;
	readonly pair: RuleRelationPair;
}

interface OverrideDisagreement extends ReviewedExpectation {
	readonly actual: RelationResolution;
	readonly judgments: PairJudgments | undefined;
}

interface QualityEvaluation {
	readonly checkedPairCount: number;
	readonly description: string;
	readonly disagreements: ReadonlyArray<OverrideDisagreement>;
	readonly matchedPairCount: number;
	readonly negativeLabelCount: number;
	readonly positiveLabelCount: number;
	readonly status: "checked-overrides" | "not-measured";
	readonly unjudgedPairs: ReadonlyArray<RuleRelationPair>;
}

interface ReportFinding extends ReviewFinding {
	readonly judgments: PairJudgments | undefined;
}

interface CappedRelation extends ScoredRelation {
	readonly judgments: PairJudgments | undefined;
}

interface RelationReviewReport {
	readonly changesSincePreviousRun: RelationBaselineComparison;
	readonly modelJudgments: {
		readonly acceptedCount: number;
		readonly capped: ReadonlyArray<CappedRelation>;
		readonly evaluatedPairCount: number;
		readonly needsReview: ReadonlyArray<ReportFinding>;
		readonly published: ReadonlyArray<GeneratedEdge>;
		readonly rejectedCount: number;
	};
	readonly qualityEvaluation: QualityEvaluation;
	readonly ruleCards: ReadonlyArray<RuleCard>;
	readonly schemaVersion: 2;
}

function matchesExpectation(actual: RelationResolution, expected: ReviewedExpectation["expected"]): boolean {
	if (expected === "unrelated") return actual.type === "none";
	if (actual.type !== "relation" || actual.relation.kind !== expected.kind) return false;

	return isDirectedKind(expected.kind)
		? actual.relation.from === expected.from && actual.relation.to === expected.to
		: getPairKey(actual.relation.from, actual.relation.to) === getPairKey(expected.from, expected.to);
}

function evaluateOverrides(options: ReviewOptions): QualityEvaluation {
	const expectations = new Map<string, ReviewedExpectation>();
	for (const pair of options.denylist) {
		expectations.set(getPairKey(pair.from, pair.to), { expected: "unrelated", pair });
	}
	for (const pin of options.pins) {
		const expected = { from: pin.from, kind: pin.kind, to: pin.to };
		expectations.set(getPairKey(pin.from, pin.to), { expected, pair: { from: pin.from, to: pin.to } });
	}

	const disagreements = new Array<OverrideDisagreement>();
	const unjudgedPairs = new Array<RuleRelationPair>();
	let matchedPairCount = 0;
	let positiveLabelCount = 0;
	let negativeLabelCount = 0;
	const orderedExpectations = [...expectations].toSorted(([left], [right]) => compareStrings(left, right));
	for (const [key, expectation] of orderedExpectations) {
		const actual = options.result.resolutions.get(key);
		if (actual === undefined) {
			unjudgedPairs.push(expectation.pair);
			continue;
		}

		if (expectation.expected === "unrelated") negativeLabelCount += 1;
		else positiveLabelCount += 1;

		if (matchesExpectation(actual, expectation.expected)) matchedPairCount += 1;
		else {
			disagreements.push({ ...expectation, actual, judgments: options.result.judgments.get(key) });
		}
	}

	const checkedPairCount = positiveLabelCount + negativeLabelCount;
	return {
		checkedPairCount,
		description:
			"Checks model decisions against manual pins and denials before overrides, link caps, and reason validation. These curated examples do not measure accuracy across all pairs.",
		disagreements,
		matchedPairCount,
		negativeLabelCount,
		positiveLabelCount,
		status: checkedPairCount === 0 ? "not-measured" : "checked-overrides",
		unjudgedPairs,
	};
}

export function createRelationReviewReport(options: ReviewOptions): RelationReviewReport {
	const { result } = options;
	const published = result.edges
		.filter((edge) => result.resolutions.has(getPairKey(edge.from, edge.to)))
		.toSorted((left, right) => compareStrings(getPairKey(left.from, left.to), getPairKey(right.from, right.to)));
	const publishedPairs = new Set(published.map((edge) => getPairKey(edge.from, edge.to)));

	const needsReview = result.reviews
		.map((finding) => ({ ...finding, judgments: result.judgments.get(getPairKey(finding.left, finding.right)) }))
		.toSorted(
			(left, right) =>
				right.strength - left.strength ||
				compareStrings(getPairKey(left.left, left.right), getPairKey(right.left, right.right)),
		);

	const reviewPairs = new Set(needsReview.map((finding) => getPairKey(finding.left, finding.right)));
	const capped = new Array<CappedRelation>();
	let rejectedCount = 0;
	let acceptedCount = 0;
	const orderedResolutions = [...result.resolutions].toSorted(([left], [right]) => compareStrings(left, right));
	for (const [key, resolution] of orderedResolutions) {
		if (resolution.type === "none") rejectedCount += 1;
		if (resolution.type !== "relation") continue;

		acceptedCount += 1;
		if (!publishedPairs.has(key) && !reviewPairs.has(key)) {
			capped.push({
				judgments: result.judgments.get(key),
				relation: resolution.relation,
				strength: resolution.strength,
			});
		}
	}

	return {
		changesSincePreviousRun: compareRelationBaseline({ current: result.edges, previous: options.previous }),
		modelJudgments: {
			acceptedCount,
			capped,
			evaluatedPairCount: result.resolutions.size,
			needsReview,
			published,
			rejectedCount,
		},
		qualityEvaluation: evaluateOverrides(options),
		ruleCards: [...options.cards.values()].toSorted((left, right) => compareStrings(left.name, right.name)),
		schemaVersion: 2,
	};
}
