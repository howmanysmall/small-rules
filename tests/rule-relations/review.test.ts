import { describe, expect, it } from "vitest";

import { judgmentThresholds } from "$script-utilities/rule-relations/constants";
import { resolvePairRelation } from "$script-utilities/rule-relations/resolve";
import { createRelationReviewReport } from "$script-utilities/rule-relations/review";
import { getPairKey } from "$script-utilities/rule-relations/types";

import { createJudgments } from "./fixtures";

import type { RuleName } from "$data/rule-manifest";
import type { RegenerationResult } from "$script-utilities/rule-relations/run";
import type { PairJudgments, RelationResolution, RuleCard } from "$script-utilities/rule-relations/types";

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
	it("checks negative labels against rejections and leaves unjudged pins unevaluated", () => {
		expect.assertions(3);

		const report = createRelationReviewReport({
			cards: new Map<RuleName, RuleCard>(),
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

	it("does not invent evaluation labels when there are no manual decisions", () => {
		expect.assertions(1);

		const report = createRelationReviewReport({
			cards: new Map<RuleName, RuleCard>(),
			denylist: [],
			pins: [],
			previous: [],
			result: createResult(createJudgments()),
		});

		expect(report.qualityEvaluation).toMatchObject({ checkedPairCount: 0, status: "not-measured" });
	});

	it("matches undirected pins in either order but detects reversed dependencies", () => {
		expect.assertions(2);

		const base = { cards: new Map<RuleName, RuleCard>(), denylist: [], previous: [] };
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

	it("keeps rejected reasons in review rather than counting them as capped or unrelated", () => {
		expect.assertions(4);

		const report = createRelationReviewReport({
			cards: new Map<RuleName, RuleCard>(),
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

	it("exposes a wrong directed prediction before a manual pin replaces it", () => {
		expect.assertions(3);

		const report = createRelationReviewReport({
			cards: new Map<RuleName, RuleCard>(),
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
