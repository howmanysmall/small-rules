import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";

import { createJudgmentCache } from "$script-utilities/rule-relations/cache";
import { judgmentPromptVersion, judgmentThresholds } from "$script-utilities/rule-relations/constants";
import { compareRelationBaseline } from "$script-utilities/rule-relations/evaluation";
import {
	createAllRulePairs,
	judgeRulePairsAsync,
	readGeneratedEdges,
	regenerateRelationsAsync,
} from "$script-utilities/rule-relations/run";
import { getPairKey, judgmentDimensions } from "$script-utilities/rule-relations/types";

import { createJudgments } from "./fixtures";

import type { RuleName } from "$data/rule-manifest";
import type {
	DecisionAnswer,
	DecisionTransport,
	PairJudgments,
	ReasonWriter,
	RelationProgress,
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

function createFakeTransport(desired: ReadonlyMap<string, PairJudgments>, calls: Array<string>): DecisionTransport {
	return {
		decide: async (options): Promise<Readonly<Record<string, DecisionAnswer>>> => {
			calls.push(options.state.name);
			const answers: Record<string, DecisionAnswer> = {};
			for (const [questionId, question] of Object.entries(options.questions)) {
				const dimension = judgmentDimensions.find((entry) => questionId.startsWith(`${entry}__`));
				const judgments = desired.get(getPairKey(options.state.name, question.instructions.candidate.name));
				if (judgments === undefined) {
					throw new Error(`Unexpected question "${questionId}".`);
				}
				if (question.type === "score") answers[questionId] = judgments.assessment;
				else if (dimension !== undefined) answers[questionId] = { noul: judgments[dimension], type: "noul" };
			}
			return answers;
		},
	};
}

function createFakeReasonWriter(reason: (from: RuleName, to: RuleName) => string): ReasonWriter {
	return { writeReason: async ({ relation }) => reason(relation.from, relation.to) };
}

describe("judgeRulePairs", () => {
	it("judges each unordered pair once and can repeat offline from cache", async () => {
		expect.assertions(5);

		const calls = new Array<string>();
		const progress = new Array<RelationProgress>();
		const desired = new Map([[getPairKey("no-print", "no-warn"), createJudgments()]]);
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
			onProgress: (update) => {
				progress.push(update);
			},
			pairs: [
				{ left: "no-warn", right: "no-print" },
				{ left: "no-print", right: "no-warn" },
			],
			promptVersion: judgmentPromptVersion,
			transport,
		};

		const first = await judgeRulePairsAsync(options);
		const second = await judgeRulePairsAsync({
			...options,
			transport: {
				decide: async () => {
					throw new Error("Network unavailable");
				},
			},
		});

		expect(first.size).toBe(1);
		expect(second.get(getPairKey("no-print", "no-warn"))).toStrictEqual(createJudgments());
		expect(first).toStrictEqual(second);
		expect(progress).toContainEqual({ cached: 0, completed: 1, phase: "judgments", total: 1 });
		expect(progress.at(-1)).toStrictEqual({ cached: 1, completed: 1, phase: "judgments", total: 1 });
	});
});

describe("regenerateRelations", () => {
	it("writes fresh relations with reasons and evidence", async () => {
		expect.assertions(6);

		const calls = new Array<string>();
		const progress = new Array<RelationProgress>();
		const desired = new Map([
			[getPairKey("no-error", "no-print"), createJudgments({ backwardReplaces: 0.9 })],
			[
				getPairKey("no-error", "no-warn"),
				createJudgments({
					assessment: { probabilities: { "0": 0.9, "1": 0.1, "2": 0 }, score: 0.1, type: "score" },
				}),
			],
			[getPairKey("no-print", "no-warn"), createJudgments()],
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
			onProgress: (update) => {
				progress.push(update);
			},
			pairs: [
				{ left: "no-print", right: "no-warn" },
				{ left: "no-print", right: "no-error" },
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
		expect(related?.evidence).toMatchObject({ judgments: { assessment: { probabilities: { "2": 0.9 } } } });
		expect(result.resolutions.get(getPairKey("no-print", "no-error"))?.type).toBe("relation");
		expect(progress.at(-1)).toStrictEqual({ cached: 0, completed: 2, phase: "reasons", total: 2 });
	});

	it("keeps untouched relations and drops re-judged ones", async () => {
		expect.assertions(1);

		const calls = new Array<string>();
		const desired = new Map([
			[
				getPairKey("no-error", "no-print"),
				createJudgments({
					assessment: { probabilities: { "0": 0.9, "1": 0.1, "2": 0 }, score: 0.1, type: "score" },
				}),
			],
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
			[
				getPairKey("no-print", "no-warn"),
				createJudgments({
					assessment: { probabilities: { "0": 0.1, "1": 0.3, "2": 0.6 }, score: 1.5, type: "score" },
				}),
			],
		]);
		const rejectedJudgments = new Map([[getPairKey("no-print", "no-warn"), createJudgments()]]);
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
		expect(nearThreshold.reviews[0]).toMatchObject({ left: "no-print", right: "no-warn", strength: 0.6 });
		expect(rejected.edges).toHaveLength(0);
		expect(rejected.reviews[0]?.concern).toContain("reason");
	});
});

describe("createAllRulePairs", () => {
	it("creates each unordered pair exactly once", () => {
		expect.assertions(1);

		expect(createAllRulePairs(["no-warn", "no-error", "no-print", "no-error"])).toStrictEqual([
			{ left: "no-error", right: "no-print" },
			{ left: "no-error", right: "no-warn" },
			{ left: "no-print", right: "no-warn" },
		]);
	});
});

describe("readGeneratedEdges", () => {
	it("reads relation identities and reasons from a document", () => {
		expect.assertions(1);

		const directory = mkdtempSync(nodePath.join(tmpdir(), "rule-relations-edges-"));
		onTestFinished(() => {
			rmSync(directory, { force: true, recursive: true });
		});
		const filePath = nodePath.join(directory, "relations.json");
		writeFileSync(
			filePath,
			'{"edges":[{"from":"no-print","kind":"related","reason":"Structured logging.","to":"no-warn"}]}',
			"utf8",
		);

		expect(readGeneratedEdges(filePath)).toStrictEqual([
			{ from: "no-print", kind: "related", reason: "Structured logging.", to: "no-warn" },
		]);
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

describe("compareRelationBaseline", () => {
	it("explains what changed from the previous generated relation file", () => {
		expect.assertions(1);

		const comparison = compareRelationBaseline({
			current: [
				{ from: "no-print", kind: "overlaps", reason: "Current.", to: "no-warn" },
				{ from: "no-error", kind: "related", reason: "Added.", to: "no-warn" },
			],
			previous: [
				{ from: "no-print", kind: "related", reason: "Previous.", to: "no-warn" },
				{ from: "no-error", kind: "related", reason: "Removed.", to: "no-print" },
			],
		});

		expect(comparison).toStrictEqual({
			added: [{ from: "no-error", kind: "related", to: "no-warn" }],
			changed: [
				{
					current: { from: "no-print", kind: "overlaps", to: "no-warn" },
					previous: { from: "no-print", kind: "related", to: "no-warn" },
				},
			],
			currentRelationCount: 2,
			description:
				"Compares this run with the generated relation file that existed before it. This measures output stability, not correctness.",
			previousRelationCount: 2,
			removed: [{ from: "no-error", kind: "related", to: "no-print" }],
			unchangedRelationCount: 0,
		});
	});
});
