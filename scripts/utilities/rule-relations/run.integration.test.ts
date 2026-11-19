import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { describe, it } from "vitest";

import { createJudgmentCache } from "$script-utilities/rule-relations/cache";
import {
	judgmentPromptVersion,
	judgmentThresholds,
	maxReasonAttempts,
	maxReasonLength,
	requestConcurrency,
} from "$script-utilities/rule-relations/constants";
import { compareRelationBaseline } from "$script-utilities/rule-relations/evaluation";
import {
	createAllRulePairs,
	judgeRulePairsAsync,
	readGeneratedEdges,
	regenerateRelationsAsync,
} from "$script-utilities/rule-relations/run";
import { getPairKey, judgmentDimensions } from "$script-utilities/rule-relations/types";

import { createJudgments } from "./fixtures";

import type { RuleName } from "$documentation/data/rule-manifest";
import type { ReasonCache } from "$script-utilities/rule-relations/cache";
import type { RegenerationResult } from "$script-utilities/rule-relations/run";
import type {
	DecisionAnswer,
	DecisionQuestion,
	DecisionTransport,
	PairJudgments,
	ReasonAttempt,
	ReasonWriter,
	RelationProgress,
	RuleCard,
	UnorderedRulePair,
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

				if (question.type === "score") {
					answers[questionId] = judgments.assessment;
				} else if (dimension !== undefined) {
					answers[questionId] = { noul: judgments[dimension], type: "noul" };
				}
			}

			return answers;
		},
	};
}

function createFakeReasonWriter(reason: (from: RuleName, to: RuleName) => string): ReasonWriter {
	return { writeReason: async ({ relation }) => reason(relation.from, relation.to) };
}

interface ConcurrencyProbe {
	readonly getPeak: () => number;
	readonly trackAsync: <TValue>(workAsync: () => Promise<TValue>) => Promise<TValue>;
}

function createConcurrencyProbe(): ConcurrencyProbe {
	let inFlight = 0;
	let peak = 0;

	return {
		getPeak: () => peak,
		trackAsync: async <TValue>(workAsync: () => Promise<TValue>): Promise<TValue> => {
			inFlight += 1;
			peak = Math.max(peak, inFlight);

			try {
				await delay(5);
				return await workAsync();
			} finally {
				inFlight -= 1;
			}
		},
	};
}

function getOnlyCandidateName(questions: Readonly<Record<string, DecisionQuestion>>): RuleName | undefined {
	return Object.values(questions)[0]?.instructions.candidate.name;
}

interface FailingTransportOptions {
	readonly failingCandidate: RuleName;
	readonly failure: Error;
	readonly started: Array<string>;
	readonly transport: DecisionTransport;
}

function createFailingTransport(options: FailingTransportOptions): DecisionTransport {
	return {
		decide: async (request): Promise<Readonly<Record<string, DecisionAnswer>>> => {
			const candidateName = getOnlyCandidateName(request.questions);
			options.started.push(`${request.state.name}/${candidateName}`);

			if (candidateName === options.failingCandidate) {
				throw options.failure;
			}

			await delay(20);
			return options.transport.decide(request);
		},
	};
}

function createFailingReasonWriter(failure: Error, failingFrom: RuleName, failingTo: RuleName): ReasonWriter {
	return {
		writeReason: async ({ relation }): Promise<string> => {
			if (relation.from === failingFrom && relation.to === failingTo) {
				throw failure;
			}

			await delay(20);
			return `Both ${relation.from} and ${relation.to} matter.`;
		},
	};
}

const everyPairRelated = new Map([
	[getPairKey("no-error", "no-print"), createJudgments()],
	[getPairKey("no-error", "no-warn"), createJudgments()],
	[getPairKey("no-print", "no-warn"), createJudgments()],
]);

const everyPair = [
	{ left: "no-error", right: "no-print" },
	{ left: "no-error", right: "no-warn" },
	{ left: "no-print", right: "no-warn" },
] satisfies ReadonlyArray<UnorderedRulePair>;

describe("judgeRulePairs", () => {
	it("judges each unordered pair once and can repeat offline from cache", async ({ expect, onTestFinished }) => {
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
			concurrency: requestConcurrency,
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

	it("keeps no more judgment requests in flight than the limit", async ({ expect }) => {
		expect.assertions(2);

		const probe = createConcurrencyProbe();
		const transport = createFakeTransport(everyPairRelated, new Array<string>());
		const judgments = await judgeRulePairsAsync({
			batchSize: 1,
			cache: undefined,
			cards: cardFixtures,
			concurrency: 2,
			decisionModel: "test-model",
			pairs: everyPair,
			promptVersion: judgmentPromptVersion,
			transport: { decide: async (options) => probe.trackAsync(async () => transport.decide(options)) },
		});

		expect(judgments.size).toBe(3);
		expect(probe.getPeak()).toBe(2);
	});

	it("caches finished batches and rethrows the original error", async ({ expect }) => {
		expect.assertions(3);

		const failure = new Error("HTTP 429: rate limited");
		const started = new Array<string>();
		const saved = new Array<PairJudgments>();
		const transport = createFakeTransport(everyPairRelated, new Array<string>());
		const run = judgeRulePairsAsync({
			batchSize: 1,
			cache: {
				get: () => undefined,
				set: (_key, value) => {
					saved.push(value);
				},
			},
			cards: cardFixtures,
			concurrency: 2,
			decisionModel: "test-model",
			pairs: everyPair,
			promptVersion: judgmentPromptVersion,
			transport: createFailingTransport({
				failingCandidate: "no-warn",
				failure,
				started,
				transport,
			}),
		});

		await expect(run).rejects.toBe(failure);
		expect(saved).toStrictEqual([createJudgments()]);
		expect(started).toStrictEqual(["no-error/no-print", "no-error/no-warn"]);
	});
});

describe("regenerateRelations", () => {
	it("writes fresh relations with reasons and evidence", async ({ expect }) => {
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
			concurrency: requestConcurrency,
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

	it("keeps untouched relations and drops re-judged ones", async ({ expect }) => {
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
			concurrency: requestConcurrency,
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

	it("surfaces near-threshold reviews and rejects ungrounded reasons", async ({ expect }) => {
		expect.assertions(4);

		// Fixed so the 0.6 fixture stays below the relatedness gate.
		const thresholds = { accept: 0.8, relatedness: 0.8, review: 0.55 };
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
			concurrency: requestConcurrency,
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
			thresholds,
			transport: createFakeTransport(nearThresholdJudgments, new Array<string>()),
		});
		const rejected = await regenerateRelationsAsync({
			allNames: ["no-error", "no-print", "no-warn"],
			batchSize: 10,
			cards: cardFixtures,
			concurrency: requestConcurrency,
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
			thresholds,
			transport: createFakeTransport(rejectedJudgments, new Array<string>()),
		});

		expect(nearThreshold.edges).toHaveLength(0);
		expect(nearThreshold.reviews[0]).toMatchObject({ left: "no-print", right: "no-warn", strength: 0.6 });
		expect(rejected.edges).toHaveLength(0);
		expect(rejected.reviews[0]?.concern).toContain("reason");
	});

	it("keeps no more reason requests in flight than the limit", async ({ expect }) => {
		expect.assertions(2);

		const probe = createConcurrencyProbe();
		const result = await regenerateRelationsAsync({
			allNames: ["no-error", "no-print", "no-warn"],
			batchSize: 10,
			cards: cardFixtures,
			concurrency: 2,
			decisionModel: "test-model",
			existingEdges: [],
			judgmentCache: undefined,
			judgmentPromptVersion,
			maxRelationsPerRule: 8,
			pairs: everyPair,
			reasonCache: undefined,
			reasonModel: "test-reason-model",
			reasonPromptVersion: 1,
			reasonWriter: {
				writeReason: async ({ relation }) =>
					probe.trackAsync(async () => `Both ${relation.from} and ${relation.to} matter.`),
			},
			thresholds: judgmentThresholds,
			transport: createFakeTransport(everyPairRelated, new Array<string>()),
		});

		expect(result.edges).toHaveLength(3);
		expect(probe.getPeak()).toBe(2);
	});

	it("caches finished reasons and rethrows the original error", async ({ expect }) => {
		expect.assertions(2);

		const failure = new Error("HTTP 503: provider overloaded");
		const saved = new Array<string>();
		const run = regenerateRelationsAsync({
			allNames: ["no-error", "no-print", "no-warn"],
			batchSize: 10,
			cards: cardFixtures,
			concurrency: 2,
			decisionModel: "test-model",
			existingEdges: [],
			judgmentCache: undefined,
			judgmentPromptVersion,
			maxRelationsPerRule: 8,
			pairs: everyPair,
			reasonCache: {
				get: () => undefined,
				set: (_key, value) => {
					saved.push(value);
				},
			},
			reasonModel: "test-reason-model",
			reasonPromptVersion: 1,
			reasonWriter: createFailingReasonWriter(failure, "no-error", "no-warn"),
			thresholds: judgmentThresholds,
			transport: createFakeTransport(everyPairRelated, new Array<string>()),
		});

		await expect(run).rejects.toBe(failure);
		expect(saved).toContain("Both no-error and no-print matter.");
	});
});

interface ScriptedReasonWriter {
	readonly received: ReadonlyArray<ReasonAttempt | undefined>;
	readonly writer: ReasonWriter;
}

function createScriptedReasonWriter(reasons: ReadonlyArray<string>): ScriptedReasonWriter {
	const received = new Array<ReasonAttempt | undefined>();
	return {
		received,
		writer: {
			writeReason: async ({ previous }): Promise<string> => {
				const reason = reasons[Math.min(received.length, reasons.length - 1)] ?? "";
				received.push(previous);
				return reason;
			},
		},
	};
}

async function regenerateOnePairAsync(
	reasonWriter: ReasonWriter,
	reasonCache?: ReasonCache,
): Promise<RegenerationResult> {
	return regenerateRelationsAsync({
		allNames: ["no-error", "no-print", "no-warn"],
		batchSize: 10,
		cards: cardFixtures,
		concurrency: requestConcurrency,
		decisionModel: "test-model",
		existingEdges: [],
		judgmentCache: undefined,
		judgmentPromptVersion,
		maxRelationsPerRule: 8,
		pairs: [{ left: "no-print", right: "no-warn" }],
		reasonCache,
		reasonModel: "test-reason-model",
		reasonPromptVersion: 1,
		reasonWriter,
		thresholds: judgmentThresholds,
		transport: createFakeTransport(
			new Map([[getPairKey("no-print", "no-warn"), createJudgments()]]),
			new Array<string>(),
		),
	});
}

describe("reason retries", () => {
	const tooLong = "a".repeat(maxReasonLength + 1);
	const lengthProblem = `Reason exceeds ${maxReasonLength} characters (${maxReasonLength + 1}).`;
	const valid = "Both no-print and no-warn matter.";

	it("retries a rejected sentence and tells the writer what was wrong", async ({ expect }) => {
		expect.assertions(3);

		const scripted = createScriptedReasonWriter([tooLong, valid]);
		const result = await regenerateOnePairAsync(scripted.writer, undefined);

		expect(result.edges.map((edge) => edge.reason)).toStrictEqual([valid]);
		expect(result.reviews).toHaveLength(0);
		expect(scripted.received).toStrictEqual([undefined, { problems: [lengthProblem], reason: tooLong }]);
	});

	it("sends the relation to review after the last attempt", async ({ expect }) => {
		expect.assertions(3);

		const scripted = createScriptedReasonWriter(["See no-error for details."]);
		const result = await regenerateOnePairAsync(scripted.writer, undefined);

		expect(scripted.received).toHaveLength(maxReasonAttempts);
		expect(result.edges).toHaveLength(0);
		expect(result.reviews[0]?.concern).toContain('Reason mentions unrelated rule "no-error".');
	});

	it("asks once when the first sentence is valid", async ({ expect }) => {
		expect.assertions(1);

		const scripted = createScriptedReasonWriter([valid]);
		await regenerateOnePairAsync(scripted.writer, undefined);

		expect(scripted.received).toStrictEqual([undefined]);
	});

	it("caches only a sentence that passed validation", async ({ expect }) => {
		expect.assertions(2);

		const rejectedSaves = new Array<string>();
		await regenerateOnePairAsync(createScriptedReasonWriter([tooLong]).writer, {
			get: () => undefined,
			set: (_key, value) => {
				rejectedSaves.push(value);
			},
		});
		const retriedSaves = new Array<string>();
		await regenerateOnePairAsync(createScriptedReasonWriter([tooLong, valid]).writer, {
			get: () => undefined,
			set: (_key, value) => {
				retriedSaves.push(value);
			},
		});

		expect(rejectedSaves).toStrictEqual([]);
		expect(retriedSaves).toStrictEqual([valid]);
	});

	it("does not serve a cached sentence that fails validation", async ({ expect }) => {
		expect.assertions(2);

		const scripted = createScriptedReasonWriter([valid]);
		const result = await regenerateOnePairAsync(scripted.writer, {
			get: () => tooLong,
			set: () => undefined,
		});

		expect(result.edges.map((edge) => edge.reason)).toStrictEqual([valid]);
		expect(scripted.received).toStrictEqual([undefined]);
	});
});

describe("createAllRulePairs", () => {
	it("creates each unordered pair exactly once", ({ expect }) => {
		expect.assertions(1);

		expect(createAllRulePairs(["no-warn", "no-error", "no-print", "no-error"])).toStrictEqual([
			{ left: "no-error", right: "no-print" },
			{ left: "no-error", right: "no-warn" },
			{ left: "no-print", right: "no-warn" },
		]);
	});
});

describe("readGeneratedEdges", () => {
	it("reads relation identities and reasons from a document", ({ expect, onTestFinished }) => {
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

	it("rejects documents with malformed edges", ({ expect, onTestFinished }) => {
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
	it("explains what changed from the previous generated relation file", ({ expect }) => {
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
