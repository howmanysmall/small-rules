import { describe, it } from "vitest";

import { resolvePairRelation } from "$script-utilities/rule-relations/resolve";

import { createJudgments } from "./fixtures";

// Fixed so the boundary cases below test the gate's logic, not the tuning
// of the production thresholds, which change with the decision model.
const judgmentThresholds = { accept: 0.8, relatedness: 0.8, review: 0.55 };

// Relatedness differs from accept so the two gates cannot be confused.
const splitThresholds = { accept: 0.8, relatedness: 0.6, review: 0.55 };

describe("relationship publication gate", () => {
	it.for([
		{ probabilities: { "0": 0.05, "1": 0.15, "2": 0.8 }, score: 1.75, verdict: "relation" },
		{ probabilities: { "0": 0.05, "1": 0.151, "2": 0.799 }, score: 1.749, verdict: "review" },
		{ probabilities: { "0": 0.8, "1": 0.15, "2": 0.05 }, score: 0.25, verdict: "none" },
		{ probabilities: { "0": 0.05, "1": 0.9, "2": 0.05 }, score: 1, verdict: "review" },
		{ probabilities: { "0": 0.5, "1": 0, "2": 0.5 }, score: 1, verdict: "review" },
	])(
		"uses publication probability rather than the weighted score: $probabilities -> $verdict",
		({ probabilities, score, verdict }, { expect }) => {
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

	it.for([{ forwardRequires: 0.55 }, { backwardReplaces: 0.79 }, { duplicates: 0.65 }])(
		"does not conceal an uncertain kind behind a generic related label: %j",
		(judgments, { expect }) => {
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

	it("does not publish an unrelated pair because a speculative kind answer is high", ({ expect }) => {
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

describe("relatedness gate", () => {
	it.for([
		{ probabilities: { "0": 0.1, "1": 0.3, "2": 0.6 }, verdict: "relation" },
		{ probabilities: { "0": 0.1, "1": 0.301, "2": 0.599 }, verdict: "review" },
		{ probabilities: { "0": 0.6, "1": 0.3, "2": 0.1 }, verdict: "none" },
	])("gates on relatedness, not accept: $probabilities -> $verdict", ({ probabilities, verdict }, { expect }) => {
		expect.assertions(1);

		const result = resolvePairRelation({
			judgments: createJudgments({ assessment: { probabilities, score: 1, type: "score" } }),
			left: "no-print",
			right: "no-warn",
			thresholds: splitThresholds,
		});

		expect(result.type).toBe(verdict);
	});
});

describe("duplicate evidence", () => {
	it("publishes strong duplicates as overlaps despite an uncertain direction", ({ expect }) => {
		expect.assertions(1);

		const result = resolvePairRelation({
			judgments: createJudgments({ duplicates: 0.9, forwardReplaces: 0.7 }),
			left: "no-print",
			right: "no-warn",
			thresholds: splitThresholds,
		});

		expect(result).toStrictEqual({
			relation: { from: "no-print", kind: "overlaps", to: "no-warn" },
			strength: 0.9,
			type: "relation",
		});
	});

	it("still reviews an uncertain direction without strong duplicates", ({ expect }) => {
		expect.assertions(1);

		const result = resolvePairRelation({
			judgments: createJudgments({ backwardRequires: 0.7, duplicates: 0.5 }),
			left: "no-print",
			right: "no-warn",
			thresholds: splitThresholds,
		});

		expect(result).toStrictEqual({
			concern: "uncertain relation kind or direction",
			strength: 0.9,
			type: "review",
		});
	});

	it("prefers an accepted directed relation over strong duplicates", ({ expect }) => {
		expect.assertions(1);

		const result = resolvePairRelation({
			judgments: createJudgments({ backwardRequires: 0.85, duplicates: 0.95 }),
			left: "no-print",
			right: "no-warn",
			thresholds: splitThresholds,
		});

		expect(result).toStrictEqual({
			relation: { from: "no-warn", kind: "depends-on", to: "no-print" },
			strength: 0.9,
			type: "relation",
		});
	});
});
