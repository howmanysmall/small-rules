import { describe, it } from "vitest";

import { judgmentThresholds, reviewReportPath } from "$script-utilities/rule-relations/constants";
import { resolvePairRelation } from "$script-utilities/rule-relations/resolve";
import { createRelationReviewReport } from "$script-utilities/rule-relations/review";
import { getPairKey } from "$script-utilities/rule-relations/types";

import { createJudgments } from "./fixtures";

import type { RegenerationResult } from "$script-utilities/rule-relations/run";
import type { PairJudgments, RelationResolution } from "$script-utilities/rule-relations/types";

function createResult(judgments: PairJudgments): RegenerationResult {
	const key = getPairKey("no-print", "no-warn");
	return {
		edges: [],
		judgments: new Map([[key, judgments]]),
		resolutions: new Map([
			[
				key,
				resolvePairRelation({ judgments, left: "no-print", right: "no-warn", thresholds: judgmentThresholds }),
			],
		]),
		reviews: [],
	};
}

describe("relation review report", () => {
	it("writes the review report outside documentation under gitignored reports/", ({ expect }) => {
		expect.assertions(1);

		expect(reviewReportPath).toBe("reports/rule-relations.review.json");
	});

	it("uses schemaVersion 3 and omits ruleCards from the report", ({ expect }) => {
		expect.assertions(2);

		const report = createRelationReviewReport({
			denylist: [],
			pins: [],
			previous: [],
			result: createResult(createJudgments()),
		});

		expect(report.schemaVersion).toBe(3);
		expect("ruleCards" in report).toBe(false);
	});

	it("checks negative labels against rejections and leaves unjudged pins unevaluated", ({ expect }) => {
		expect.assertions(3);

		const report = createRelationReviewReport({
			denylist: [{ from: "no-warn", to: "no-print" }],
			pins: [{ from: "no-error", kind: "related", reason: "Fixture.", to: "no-print" }],
			previous: [],
			result: createResult(
				createJudgments({
					assessment: { probabilities: { "0": 0.9, "1": 0.1, "2": 0 }, score: 0.1, type: "score" },
				}),
			),
		});

		expect(report.qualityEvaluation).toMatchObject({
			checkedPairCount: 1,
			matchedPairCount: 1,
			negativeLabelCount: 1,
			positiveLabelCount: 0,
		});
		expect(report.qualityEvaluation.unjudgedPairs).toStrictEqual([{ from: "no-error", to: "no-print" }]);
		expect(report.modelJudgments.rejectedCount).toBe(1);
	});

	it("does not invent evaluation labels when there are no manual decisions", ({ expect }) => {
		expect.assertions(1);

		const report = createRelationReviewReport({
			denylist: [],
			pins: [],
			previous: [],
			result: createResult(createJudgments()),
		});

		expect(report.qualityEvaluation).toMatchObject({ checkedPairCount: 0, status: "not-measured" });
	});

	it("matches undirected pins in either order but detects reversed dependencies", ({ expect }) => {
		expect.assertions(2);

		const base = { denylist: [], previous: [] };
		const related = createRelationReviewReport({
			...base,
			pins: [{ from: "no-warn", kind: "related", reason: "Fixture.", to: "no-print" }],
			result: createResult(createJudgments()),
		});
		const reversed = createRelationReviewReport({
			...base,
			pins: [{ from: "no-warn", kind: "depends-on", reason: "Fixture.", to: "no-print" }],
			result: createResult(createJudgments({ forwardRequires: 0.9 })),
		});

		expect(related.qualityEvaluation.matchedPairCount).toBe(1);
		expect(reversed.qualityEvaluation.disagreements).toHaveLength(1);
	});

	it("keeps rejected reasons in review rather than counting them as capped or unrelated", ({ expect }) => {
		expect.assertions(4);

		const report = createRelationReviewReport({
			denylist: [],
			pins: [],
			previous: [],
			result: {
				...createResult(createJudgments()),
				reviews: [{ concern: "reason rejected", left: "no-print", right: "no-warn", strength: 0.9 }],
			},
		});

		expect(report.modelJudgments.needsReview).toMatchObject([
			{ judgments: { assessment: { probabilities: { "2": 0.9 } } } },
		]);
		expect(report.modelJudgments.capped).toHaveLength(0);
		expect(report.modelJudgments.rejectedCount).toBe(0);
		expect(report.modelJudgments.published).toHaveLength(0);
	});

	it("omits low-signal relationship reviews while keeping actionable, non-relationship, and unjudged findings", ({
		expect,
	}) => {
		expect.assertions(4);

		const lowSignalKey = getPairKey("curly", "no-print");
		const publishLeaningKey = getPairKey("no-print", "no-warn");
		const reviewLeaningKey = getPairKey("no-error", "no-print");
		const kindUncertainKey = getPairKey("no-error", "no-warn");

		const report = createRelationReviewReport({
			denylist: [],
			pins: [],
			previous: [],
			result: {
				edges: [],
				judgments: new Map([
					[
						kindUncertainKey,
						createJudgments({
							assessment: { probabilities: { "0": 0.7, "1": 0.1, "2": 0.2 }, score: 0.5, type: "score" },
						}),
					],
					[
						lowSignalKey,
						createJudgments({
							assessment: {
								probabilities: { "0": 0.78, "1": 0.19, "2": 0.03 },
								score: 0.25,
								type: "score",
							},
						}),
					],
					[
						publishLeaningKey,
						createJudgments({
							assessment: {
								probabilities: { "0": 0.15, "1": 0.25, "2": 0.6 },
								score: 1.45,
								type: "score",
							},
						}),
					],
					[
						reviewLeaningKey,
						createJudgments({
							assessment: {
								probabilities: { "0": 0.35, "1": 0.45, "2": 0.2 },
								score: 0.85,
								type: "score",
							},
						}),
					],
				]),
				resolutions: new Map(),
				reviews: [
					{
						concern: "relationship needs review",
						left: "curly",
						right: "no-print",
						strength: 0.03,
					},
					{
						concern: "relationship needs review",
						left: "no-print",
						right: "no-warn",
						strength: 0.6,
					},
					{
						concern: "relationship needs review",
						left: "no-error",
						right: "no-print",
						strength: 0.2,
					},
					{
						concern: "uncertain relation kind or direction",
						left: "no-error",
						right: "no-warn",
						strength: 0.2,
					},
					{
						concern: "relationship needs review",
						left: "no-print",
						right: "prefer-idiv",
						strength: 0.1,
					},
				],
			},
		});

		expect(report.modelJudgments.needsReviewCount).toBe(5);
		expect(report.modelJudgments.omittedLowSignalReviewCount).toBe(1);
		expect(report.modelJudgments.needsReview.map((finding) => [finding.left, finding.right])).toStrictEqual([
			["no-print", "no-warn"],
			["no-error", "no-print"],
			["no-error", "no-warn"],
			["no-print", "prefer-idiv"],
		]);
		expect(report.modelJudgments.capped).toHaveLength(0);
	});

	it("exposes a wrong directed prediction before a manual pin replaces it", ({ expect }) => {
		expect.assertions(3);

		const report = createRelationReviewReport({
			denylist: [],
			pins: [{ from: "no-print", kind: "related", reason: "Both enforce structured logging.", to: "no-warn" }],
			previous: [],
			result: {
				edges: [],
				judgments: new Map([[getPairKey("no-print", "no-warn"), createJudgments({ forwardReplaces: 0.95 })]]),
				resolutions: new Map<string, RelationResolution>([
					[
						getPairKey("no-print", "no-warn"),
						{
							relation: { from: "no-print", kind: "supersedes", to: "no-warn" },
							strength: 0.9,
							type: "relation",
						},
					],
				]),
				reviews: [],
			},
		});

		expect(report.qualityEvaluation.checkedPairCount).toBe(1);
		expect(report.qualityEvaluation.disagreements).toMatchObject([
			{
				actual: { relation: { kind: "supersedes" } },
				expected: { from: "no-print", kind: "related", to: "no-warn" },
			},
		]);
		expect(report.modelJudgments.capped).toMatchObject([{ relation: { kind: "supersedes" } }]);
	});
});
