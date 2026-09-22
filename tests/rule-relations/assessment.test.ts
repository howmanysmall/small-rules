import { describe, expect, it } from "vitest";

import { judgmentThresholds } from "$script-utilities/rule-relations/constants";
import { resolvePairRelation } from "$script-utilities/rule-relations/resolve";

import { createJudgments } from "./fixtures";

describe("relationship publication gate", () => {
	it.each([
		{ probabilities: { "0": 0.05, "1": 0.15, "2": 0.8 }, score: 1.75, verdict: "relation" },
		{ probabilities: { "0": 0.05, "1": 0.151, "2": 0.799 }, score: 1.749, verdict: "review" },
		{ probabilities: { "0": 0.8, "1": 0.15, "2": 0.05 }, score: 0.25, verdict: "none" },
		{ probabilities: { "0": 0.05, "1": 0.9, "2": 0.05 }, score: 1, verdict: "review" },
		{ probabilities: { "0": 0.5, "1": 0, "2": 0.5 }, score: 1, verdict: "review" },
	])(
		"uses publication probability rather than the weighted score: $probabilities -> $verdict",
		({ probabilities, score, verdict }) => {
			expect.assertions(1);

			const result = resolvePairRelation({
				judgments: createJudgments({ assessment: { probabilities, score, type: "score" } }),
				left: "no-print",
				right: "no-warn",
				thresholds: judgmentThresholds,
			});

			expect(result.type).toBe(verdict);
		},
	);

	it.each([{ forwardRequires: 0.55 }, { backwardReplaces: 0.79 }, { duplicates: 0.65 }])(
		"does not conceal an uncertain kind behind a generic related label: %j",
		(judgments) => {
			expect.assertions(1);

			expect(
				resolvePairRelation({
					judgments: createJudgments(judgments),
					left: "no-print",
					right: "no-warn",
					thresholds: judgmentThresholds,
				}).type,
			).toBe("review");
		},
	);

	it("does not publish an unrelated pair because a speculative kind answer is high", () => {
		expect.assertions(1);

		const result = resolvePairRelation({
			judgments: createJudgments({
				assessment: { probabilities: { "0": 0.95, "1": 0.04, "2": 0.01 }, score: 0.06, type: "score" },
				forwardReplaces: 0.99,
			}),
			left: "no-print",
			right: "no-warn",
			thresholds: judgmentThresholds,
		});

		expect(result.type).toBe("none");
	});
});
