import { describe, expect, it } from "vitest";

import { judgmentThresholds } from "$script-utilities/rule-relations/constants";
import { createPairJudgmentQuestions, interpretJudgmentAnswers } from "$script-utilities/rule-relations/questions";
import { applyRelationCap, resolvePairRelation } from "$script-utilities/rule-relations/resolve";

import type { RuleName } from "$data/rule-manifest";
import type { NoulAnswer, PairJudgments, RuleCard, ScoredRelation } from "$script-utilities/rule-relations/types";

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

function createJudgments(overrides: Partial<PairJudgments> = {}): PairJudgments {
	return { duplicates: 0, exists: 0, replaces: 0, requires: 0, ...overrides };
}

function createScoredRelation(from: RuleName, to: RuleName, strength: number): ScoredRelation {
	return { relation: { from, kind: "related", to }, strength };
}

describe("createPairJudgmentQuestions", () => {
	it("asks four questions per candidate pair", () => {
		expect.assertions(6);

		const questions = createPairJudgmentQuestions([noWarnCard, noErrorCard]);

		expect(Object.keys(questions)).toStrictEqual([
			"duplicates__no-warn",
			"exists__no-warn",
			"replaces__no-warn",
			"requires__no-warn",
			"duplicates__no-error",
			"exists__no-error",
			"replaces__no-error",
			"requires__no-error",
		]);
		expect(questions["exists__no-warn"]?.type).toBe("noul");
		expect(questions["exists__no-warn"]?.instructions.candidate.name).toBe("no-warn");
		expect(questions["exists__no-warn"]?.instructions.question.length).toBeGreaterThan(0);
		expect(questions["exists__no-warn"]?.criteria.true.length).toBeGreaterThan(0);
		expect(questions["exists__no-warn"]?.criteria.false.length).toBeGreaterThan(0);
	});
});

describe("interpretJudgmentAnswers", () => {
	it("maps answers back to per-candidate judgment scores", () => {
		expect.assertions(2);

		const answers = {
			"duplicates__no-warn": { noul: 0.75, type: "noul" },
			"exists__no-warn": { noul: 0.9, type: "noul" },
			"replaces__no-warn": { noul: 0.1, type: "noul" },
			"requires__no-warn": { noul: 0.2, type: "noul" },
		} satisfies Record<string, NoulAnswer>;
		const judgments = interpretJudgmentAnswers(answers, [noWarnCard]);

		expect(judgments.size).toBe(1);
		expect(judgments.get("no-warn")).toStrictEqual({
			duplicates: 0.75,
			exists: 0.9,
			replaces: 0.1,
			requires: 0.2,
		} satisfies PairJudgments);
	});

	it("throws when an answer is missing", () => {
		expect.assertions(1);

		expect(() =>
			interpretJudgmentAnswers({ "exists__no-warn": { noul: 0.9, type: "noul" } }, [noWarnCard]),
		).toThrow('Missing answer for "duplicates__no-warn".');
	});
});

describe("resolvePairRelation", () => {
	const left = "no-print";
	const right = "no-warn";

	it("accepts a single high directed score as a directed relation", () => {
		expect.assertions(2);

		const supersedes = resolvePairRelation({
			backward: createJudgments(),
			forward: createJudgments({ replaces: 0.9 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});
		const dependsOn = resolvePairRelation({
			backward: createJudgments({ requires: 0.85 }),
			forward: createJudgments(),
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
			strength: 0.85,
			type: "relation",
		});
	});

	it("routes conflicting directed scores to review", () => {
		expect.assertions(1);

		const resolution = resolvePairRelation({
			backward: createJudgments({ replaces: 0.9 }),
			forward: createJudgments({ replaces: 0.95 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});

		expect(resolution).toStrictEqual({ concern: "conflicting directed judgments", strength: 0.95, type: "review" });
	});

	it("routes same-direction kind conflicts to review", () => {
		expect.assertions(1);

		const resolution = resolvePairRelation({
			backward: createJudgments(),
			forward: createJudgments({ replaces: 0.9, requires: 0.9 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});

		expect(resolution).toStrictEqual({ concern: "conflicting directed judgments", strength: 0.9, type: "review" });
	});

	it("falls back to undirected kinds by score priority", () => {
		expect.assertions(3);

		const overlapsFromBackward = resolvePairRelation({
			backward: createJudgments({ duplicates: 0.85 }),
			forward: createJudgments({ duplicates: 0.1 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});
		const directedBeatsOverlaps = resolvePairRelation({
			backward: createJudgments({ duplicates: 0.95 }),
			forward: createJudgments({ replaces: 0.9 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});
		const related = resolvePairRelation({
			backward: createJudgments(),
			forward: createJudgments({ exists: 0.8 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});

		expect(overlapsFromBackward).toStrictEqual({
			relation: { from: left, kind: "overlaps", to: right },
			strength: 0.85,
			type: "relation",
		});
		expect(directedBeatsOverlaps).toStrictEqual({
			relation: { from: left, kind: "supersedes", to: right },
			strength: 0.9,
			type: "relation",
		});
		expect(related).toStrictEqual({
			relation: { from: left, kind: "related", to: right },
			strength: 0.8,
			type: "relation",
		});
	});

	it("reviews near-threshold pairs and ignores weak ones", () => {
		expect.assertions(2);

		const nearThreshold = resolvePairRelation({
			backward: createJudgments(),
			forward: createJudgments({ exists: 0.6 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});
		const weak = resolvePairRelation({
			backward: createJudgments({ exists: 0.5 }),
			forward: createJudgments({ duplicates: 0.2 }),
			left,
			right,
			thresholds: judgmentThresholds,
		});

		expect(nearThreshold).toStrictEqual({ concern: "near-threshold judgments", strength: 0.6, type: "review" });
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
