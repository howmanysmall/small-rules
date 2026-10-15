import { describe, expect, it } from "vitest";

import { judgmentThresholds } from "$script-utilities/rule-relations/constants";
import { createPairJudgmentQuestions, interpretJudgmentAnswers } from "$script-utilities/rule-relations/questions";
import { applyRelationCap, resolvePairRelation } from "$script-utilities/rule-relations/resolve";

import { createJudgments } from "./fixtures";

import type { RuleName } from "$data/rule-manifest";
import type { DecisionAnswer, RuleCard, ScoredRelation } from "$script-utilities/rule-relations/types";

function createCardFixture(name: RuleName, title: string): RuleCard {
	return {
		name,
		category: "roblox",
		description: `${title} description.`,
		examples: [],
		messages: [],
		options: "{}",
		rationale: "",
		sharedUtilities: [],
		title,
	};
}

const noWarnCard = createCardFixture("no-warn", "No Warn");
const noErrorCard = createCardFixture("no-error", "No Error");

function createScoredRelation(from: RuleName, to: RuleName, strength: number): ScoredRelation {
	return { relation: { from, kind: "related", to }, strength };
}

describe("createPairJudgmentQuestions", () => {
	it("supplies evidence to an overall assessment and both directions in the same request", () => {
		expect.assertions(5);

		const questions = createPairJudgmentQuestions([noWarnCard, noErrorCard]);

		expect(questions["assessment__no-warn"]?.type).toBe("score");
		expect(questions["assessment__no-warn"]?.instructions.candidate).toStrictEqual(noWarnCard);
		expect(questions["assessment__no-error"]?.instructions.candidate).toStrictEqual(noErrorCard);
		expect(questions["forwardRequires__no-warn"]?.type).toBe("noul");
		expect(questions["backwardRequires__no-warn"]?.type).toBe("noul");
	});
});

describe("interpretJudgmentAnswers", () => {
	it("maps answers back to per-candidate judgment scores", () => {
		expect.assertions(2);

		const answers = {
			"assessment__no-warn": { probabilities: { "0": 0.02, "1": 0.08, "2": 0.9 }, score: 1.88, type: "score" },
			"backwardReplaces__no-warn": { noul: 0.3, type: "noul" },
			"backwardRequires__no-warn": { noul: 0.4, type: "noul" },
			"duplicates__no-warn": { noul: 0.75, type: "noul" },
			"forwardReplaces__no-warn": { noul: 0.1, type: "noul" },
			"forwardRequires__no-warn": { noul: 0.2, type: "noul" },
		} satisfies Record<string, DecisionAnswer>;
		const judgments = interpretJudgmentAnswers(answers, [noWarnCard]);

		expect(judgments.size).toBe(1);
		expect(judgments.get("no-warn")).toStrictEqual(
			createJudgments({
				backwardReplaces: 0.3,
				backwardRequires: 0.4,
				duplicates: 0.75,
				forwardReplaces: 0.1,
				forwardRequires: 0.2,
			}),
		);
	});

	it("throws when an answer is missing", () => {
		expect.assertions(1);

		expect(() => interpretJudgmentAnswers({}, [noWarnCard])).toThrow(TypeError);
	});
});

describe("resolvePairRelation", () => {
	const left = "no-print";
	const right = "no-warn";

	it("accepts a single high directed score as a directed relation", () => {
		expect.assertions(2);

		const supersedes = resolvePairRelation({
			judgments: createJudgments({ forwardReplaces: 0.9 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});
		const dependsOn = resolvePairRelation({
			judgments: createJudgments({ backwardRequires: 0.85 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});

		expect(supersedes).toStrictEqual({
			relation: { from: left, kind: "supersedes", to: right },
			strength: 0.9,
			type: "relation",
		});
		expect(dependsOn).toStrictEqual({
			relation: { from: right, kind: "depends-on", to: left },
			strength: 0.9,
			type: "relation",
		});
	});

	it("routes conflicting directed scores to review", () => {
		expect.assertions(1);

		const resolution = resolvePairRelation({
			judgments: createJudgments({ backwardReplaces: 0.9, forwardReplaces: 0.95 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});

		expect(resolution).toMatchObject({ type: "review" });
	});

	it("routes same-direction kind conflicts to review", () => {
		expect.assertions(1);

		const resolution = resolvePairRelation({
			judgments: createJudgments({ forwardReplaces: 0.9, forwardRequires: 0.9 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});

		expect(resolution).toMatchObject({ type: "review" });
	});

	it("falls back to undirected kinds by score priority", () => {
		expect.assertions(3);

		const overlaps = resolvePairRelation({
			judgments: createJudgments({ duplicates: 0.85 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});
		const directedBeatsOverlaps = resolvePairRelation({
			judgments: createJudgments({ duplicates: 0.95, forwardReplaces: 0.9 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});
		const related = resolvePairRelation({
			judgments: createJudgments(),
			left,
			right,
			thresholds: judgmentThresholds,
		});

		expect(overlaps).toStrictEqual({
			relation: { from: left, kind: "overlaps", to: right },
			strength: 0.9,
			type: "relation",
		});
		expect(directedBeatsOverlaps).toStrictEqual({
			relation: { from: left, kind: "supersedes", to: right },
			strength: 0.9,
			type: "relation",
		});
		expect(related).toStrictEqual({
			relation: { from: left, kind: "related", to: right },
			strength: 0.9,
			type: "relation",
		});
	});

	it("reviews near-threshold pairs and ignores weak ones", () => {
		expect.assertions(2);

		const nearThreshold = resolvePairRelation({
			judgments: createJudgments({
				assessment: { probabilities: { "0": 0.1, "1": 0.3, "2": 0.6 }, score: 1.5, type: "score" },
			}),
			left,
			right,
			thresholds: judgmentThresholds,
		});
		const weak = resolvePairRelation({
			judgments: createJudgments({
				assessment: { probabilities: { "0": 0.9, "1": 0.1, "2": 0 }, score: 0.1, type: "score" },
			}),
			left,
			right,
			thresholds: judgmentThresholds,
		});

		expect(nearThreshold).toMatchObject({ strength: 0.6, type: "review" });
		expect(weak).toStrictEqual({ type: "none" });
	});
});

describe("applyRelationCap", () => {
	it("keeps the strongest relations up to the per-rule cap", () => {
		expect.assertions(1);

		const relations = [
			createScoredRelation("no-print", "no-warn", 0.9),
			createScoredRelation("no-print", "no-error", 0.8),
			createScoredRelation("no-print", "prefer-idiv", 0.7),
		];
		const capped = applyRelationCap(relations, 2);

		expect(capped.map((scored) => scored.relation.to)).toStrictEqual(["no-warn", "no-error"]);
	});

	it("counts both endpoints against the cap", () => {
		expect.assertions(1);

		const relations = [
			createScoredRelation("no-print", "no-warn", 0.9),
			createScoredRelation("no-warn", "no-error", 0.8),
			createScoredRelation("no-print", "no-error", 0.7),
		];
		const capped = applyRelationCap(relations, 1);

		expect(capped).toStrictEqual([relations[0]]);
	});

	it("breaks strength ties deterministically by endpoints", () => {
		expect.assertions(1);

		const relations = [
			createScoredRelation("no-print", "no-warn", 0.9),
			createScoredRelation("no-print", "no-error", 0.9),
		];
		const capped = applyRelationCap(relations, 1);

		expect(capped.map((scored) => scored.relation.to)).toStrictEqual(["no-error"]);
	});
});
