import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";

import { createJudgmentCache } from "$script-utilities/rule-relations/cache";
import { judgmentPromptVersion, judgmentThresholds } from "$script-utilities/rule-relations/constants";
import { evaluatePairs } from "$script-utilities/rule-relations/eval-fixture";
import {
	createAllRulePairs,
	judgeRulePairsAsync,
	readGeneratedEdges,
	regenerateRelationsAsync,
} from "$script-utilities/rule-relations/run";
import { getJudgmentKey, getPairKey, judgmentDimensions } from "$script-utilities/rule-relations/types";

import type { RuleName } from "$data/rule-manifest";
import type {
	DecisionTransport,
	NoulAnswer,
	PairJudgments,
	ReasonWriter,
	RuleCard,
} from "$script-utilities/rule-relations/types";

const cardFixtures: ReadonlyMap<RuleName, RuleCard> = new Map<RuleName, RuleCard>([
	[
		"no-error",
		{
			name: "no-error",
			category: "roblox",
			description: "Throw instead of error().",
			examples: [],
			messages: [],
			options: "{}",
			rationale: "",
			sharedUtilities: [],
			title: "No Error",
		},
	],
	[
		"no-print",
		{
			name: "no-print",
			category: "roblox",
			description: "Use Log instead of print().",
			examples: [],
			messages: [],
			options: "{}",
			rationale: "",
			sharedUtilities: [],
			title: "No Print",
		},
	],
	[
		"no-warn",
		{
			name: "no-warn",
			category: "roblox",
			description: "Use Log instead of warn().",
			examples: [],
			messages: [],
			options: "{}",
			rationale: "",
			sharedUtilities: [],
			title: "No Warn",
		},
	],
]);

function createJudgments(overrides: Partial<PairJudgments> = {}): PairJudgments {
	return { duplicates: 0, exists: 0, replaces: 0, requires: 0, ...overrides };
}

function createFakeTransport(desired: ReadonlyMap<string, PairJudgments>, calls: Array<string>): DecisionTransport {
	return {
		decide: async (options): Promise<Readonly<Record<string, NoulAnswer>>> => {
			calls.push(options.state.name);
			const answers: Record<string, NoulAnswer> = {};
			for (const [questionId, question] of Object.entries(options.questions)) {
				const dimension = judgmentDimensions.find((entry) => questionId.startsWith(`${entry}__`));
				const judgments = desired.get(getJudgmentKey(options.state.name, question.instructions.candidate.name));
				if (dimension === undefined || judgments === undefined) {
					throw new Error(`Unexpected question "${questionId}".`);
				}
				answers[questionId] = { noul: judgments[dimension], type: "noul" };
			}
			return answers;
		},
	};
}

function createFakeReasonWriter(reason: (from: RuleName, to: RuleName) => string): ReasonWriter {
	return { writeReason: async ({ relation }) => reason(relation.from, relation.to) };
}

describe("judgeRulePairs", () => {
	it("judges both directions once and reuses the cache afterwards", async () => {
		expect.assertions(4);

		const calls = new Array<string>();
		const desired = new Map([
			[getJudgmentKey("no-print", "no-warn"), createJudgments({ exists: 0.9 })],
			[getJudgmentKey("no-warn", "no-print"), createJudgments({ exists: 0.85 })],
		]);
		const directory = mkdtempSync(nodePath.join(tmpdir(), "rule-relations-run-"));
		onTestFinished(() => {
			rmSync(directory, { force: true, recursive: true });
		});
		const cache = createJudgmentCache(directory);
		const transport = createFakeTransport(desired, calls);
		const options: Parameters<typeof judgeRulePairsAsync>[0] = {
			batchSize: 10,
			cache,
			cards: cardFixtures,
			decisionModel: "test-model",
			pairs: [{ left: "no-print", right: "no-warn" }],
			promptVersion: judgmentPromptVersion,
			transport,
		};

		const first = await judgeRulePairsAsync(options);
		const second = await judgeRulePairsAsync(options);

		expect(first.size).toBe(2);
		expect(calls).toHaveLength(2);
		expect(second.get(getJudgmentKey("no-print", "no-warn"))).toStrictEqual(createJudgments({ exists: 0.9 }));
		expect(calls).toHaveLength(2);
	});
});

describe("regenerateRelations", () => {
	it("writes fresh relations with reasons and evidence", async () => {
		expect.assertions(5);

		const calls = new Array<string>();
		const desired = new Map([
			[getJudgmentKey("no-error", "no-print"), createJudgments()],
			[getJudgmentKey("no-error", "no-warn"), createJudgments({ exists: 0.1 })],
			[getJudgmentKey("no-print", "no-error"), createJudgments({ replaces: 0.9 })],
			[getJudgmentKey("no-print", "no-warn"), createJudgments({ exists: 0.9 })],
			[getJudgmentKey("no-warn", "no-error"), createJudgments()],
			[getJudgmentKey("no-warn", "no-print"), createJudgments({ exists: 0.85 })],
		]);
		const result = await regenerateRelationsAsync({
			allNames: ["no-error", "no-print", "no-warn"],
			batchSize: 10,
			cards: cardFixtures,
			decisionModel: "test-model",
			existingEdges: [],
			judgmentCache: undefined,
			judgmentPromptVersion,
			maxRelationsPerRule: 8,
			pairs: [
				{ left: "no-print", right: "no-warn" },
				{ left: "no-error", right: "no-print" },
				{ left: "no-error", right: "no-warn" },
			],
			reasonCache: undefined,
			reasonModel: "test-reason-model",
			reasonPromptVersion: 1,
			reasonWriter: createFakeReasonWriter((from, to) => `Both ${from} and ${to} matter.`),
			thresholds: judgmentThresholds,
			transport: createFakeTransport(desired, calls),
		});

		const related = result.edges.find((edge) => edge.kind === "related");
		const supersedes = result.edges.find((edge) => edge.kind === "supersedes");

		expect(result.edges).toHaveLength(2);
		expect(supersedes).toMatchObject({ from: "no-print", to: "no-error" });
		expect(related?.reason).toBe("Both no-print and no-warn matter.");
		expect(related?.evidence?.forward.exists).toBeCloseTo(0.9);
		expect(result.resolutions.get(getPairKey("no-print", "no-error"))?.type).toBe("relation");
	});

	it("keeps untouched relations and drops re-judged ones", async () => {
		expect.assertions(1);

		const calls = new Array<string>();
		const desired = new Map([
			[getJudgmentKey("no-error", "no-print"), createJudgments({ exists: 0.1 })],
			[getJudgmentKey("no-print", "no-error"), createJudgments()],
		]);
		const result = await regenerateRelationsAsync({
			allNames: ["no-error", "no-print", "no-warn"],
			batchSize: 10,
			cards: cardFixtures,
			decisionModel: "test-model",
			existingEdges: [
				{ from: "no-print", kind: "related", reason: "Retained.", to: "no-warn" },
				{ from: "no-error", kind: "related", reason: "Stale.", to: "no-print" },
			],
			judgmentCache: undefined,
			judgmentPromptVersion,
			maxRelationsPerRule: 8,
			pairs: [{ left: "no-error", right: "no-print" }],
			reasonCache: undefined,
			reasonModel: "test-reason-model",
			reasonPromptVersion: 1,
			reasonWriter: createFakeReasonWriter((from, to) => `Both ${from} and ${to} matter.`),
			thresholds: judgmentThresholds,
			transport: createFakeTransport(desired, calls),
		});

		expect(result.edges.map((edge) => edge.reason)).toStrictEqual(["Retained."]);
	});

	it("surfaces near-threshold reviews and rejects ungrounded reasons", async () => {
		expect.assertions(4);

		const nearThresholdJudgments = new Map([
			[getJudgmentKey("no-print", "no-warn"), createJudgments({ exists: 0.6 })],
			[getJudgmentKey("no-warn", "no-print"), createJudgments()],
		]);
		const rejectedJudgments = new Map([
			[getJudgmentKey("no-print", "no-warn"), createJudgments({ exists: 0.9 })],
			[getJudgmentKey("no-warn", "no-print"), createJudgments()],
		]);
		const nearThreshold = await regenerateRelationsAsync({
			allNames: ["no-error", "no-print", "no-warn"],
			batchSize: 10,
			cards: cardFixtures,
			decisionModel: "test-model",
			existingEdges: [],
			judgmentCache: undefined,
			judgmentPromptVersion,
			maxRelationsPerRule: 8,
			pairs: [{ left: "no-print", right: "no-warn" }],
			reasonCache: undefined,
			reasonModel: "test-reason-model",
			reasonPromptVersion: 1,
			reasonWriter: createFakeReasonWriter((from, to) => `Both ${from} and ${to} matter.`),
			thresholds: judgmentThresholds,
			transport: createFakeTransport(nearThresholdJudgments, new Array<string>()),
		});
		const rejected = await regenerateRelationsAsync({
			allNames: ["no-error", "no-print", "no-warn"],
			batchSize: 10,
			cards: cardFixtures,
			decisionModel: "test-model",
			existingEdges: [],
			judgmentCache: undefined,
			judgmentPromptVersion,
			maxRelationsPerRule: 8,
			pairs: [{ left: "no-print", right: "no-warn" }],
			reasonCache: undefined,
			reasonModel: "test-reason-model",
			reasonPromptVersion: 1,
			reasonWriter: createFakeReasonWriter(() => "See no-error for details."),
			thresholds: judgmentThresholds,
			transport: createFakeTransport(rejectedJudgments, new Array<string>()),
		});

		expect(nearThreshold.edges).toHaveLength(0);
		expect(nearThreshold.reviews[0]?.concern).toBe("near-threshold judgments");
		expect(rejected.edges).toHaveLength(0);
		expect(rejected.reviews[0]?.concern).toContain("reason");
	});
});

describe("createAllRulePairs", () => {
	it("creates each unordered pair exactly once", () => {
		expect.assertions(1);

		expect(createAllRulePairs(["no-error", "no-print", "no-warn"])).toStrictEqual([
			{ left: "no-error", right: "no-print" },
			{ left: "no-error", right: "no-warn" },
			{ left: "no-print", right: "no-warn" },
		]);
	});
});

describe("readGeneratedEdges", () => {
	it("reads the committed relation document", () => {
		expect.assertions(2);

		const edges = readGeneratedEdges("documentation/src/data/generated/rule-relations.json");

		expect(edges.length).toBeGreaterThan(0);
		expect(edges).toContainEqual(expect.objectContaining({ from: "no-print", to: "no-warn" }));
	});

	it("rejects documents with malformed edges", () => {
		expect.assertions(1);

		const directory = mkdtempSync(nodePath.join(tmpdir(), "rule-relations-edges-"));
		onTestFinished(() => {
			rmSync(directory, { force: true, recursive: true });
		});
		const filePath = nodePath.join(directory, "bad.json");
		writeFileSync(filePath, '{"edges": [{"from": "no-print"}]}', "utf8");

		expect(() => readGeneratedEdges(filePath)).toThrow("Invalid relation edge");
	});
});

describe("evaluatePairs", () => {
	it("scores resolutions against the evaluation fixture", () => {
		expect.assertions(1);

		const report = evaluatePairs({
			expectedNegatives: [{ left: "ban-react-fc", right: "no-task-wait" }],
			expectedPositives: [{ kind: "related", pair: { left: "no-print", right: "no-warn" } }],
			resolutions: new Map([
				[getPairKey("ban-react-fc", "no-task-wait"), { type: "none" }],
				[
					getPairKey("no-print", "no-warn"),
					{
						relation: { from: "no-print", kind: "overlaps", to: "no-warn" },
						strength: 0.9,
						type: "relation",
					},
				],
			]),
		});

		expect(report).toStrictEqual({
			falseNegatives: 0,
			falsePositives: 0,
			kindMismatches: 1,
			trueNegatives: 1,
			truePositives: 1,
		});
	});
});
