import { describe, it, vi } from "vitest";
import { OpenRouter } from "@openrouter/sdk";
import { RequestAbortedError, TooManyRequestsResponseError } from "@openrouter/sdk/models/errors";

import {
	createOpenRouterClientOptions,
	createOpenRouterDecisionTransport,
	createOpenRouterReasonWriter,
	createOpenRouterRequestOptions,
} from "$script-utilities/rule-relations/openrouter";

import type { DecisionsResponse } from "@openrouter/sdk/models";

import type { RuleName } from "$documentation/data/rule-manifest";
import type { RelationUsage, RuleCard } from "$script-utilities/rule-relations/types";

const noPrintCard: RuleCard = {
	name: "no-print",
	category: "roblox",
	description: "Use Log instead of print().",
	examples: [],
	messages: [],
	options: "{}",
	rationale: "",
	sharedUtilities: [],
	title: "No Print",
};

const noWarnCard: RuleCard = {
	name: "no-warn",
	category: "roblox",
	description: "Use Log instead of warn().",
	examples: [],
	messages: [],
	options: "{}",
	rationale: "",
	sharedUtilities: [],
	title: "No Warn",
};

const decisionsBody = { answers: {}, model: "test-model", usage: { input_tokens: 1, output_tokens: 1 } };

function createScriptedResponse(status: number): Response {
	if (status === 200) return Response.json(decisionsBody, { status });

	return Response.json(
		{ error: { code: status, message: `HTTP ${status}` } },
		{ headers: { "retry-after": "2" }, status },
	);
}

type ScriptedStep = Error | number;

function createScriptedFetch(steps: ReadonlyArray<ScriptedStep>, seen: Array<ScriptedStep>): () => Promise<Response> {
	return async function fetchScriptedAsync(): Promise<Response> {
		const step = steps[Math.min(seen.length, steps.length - 1)] ?? 200;
		seen.push(step);

		if (step instanceof Error) {
			throw step;
		}

		return createScriptedResponse(step);
	};
}

function createScriptedClient(steps: ReadonlyArray<ScriptedStep>, seen: Array<ScriptedStep>): OpenRouter {
	vi.stubGlobal("fetch", createScriptedFetch(steps, seen));
	return new OpenRouter(createOpenRouterClientOptions("test-key"));
}

function createTlsHandshakeError(): TypeError {
	return Object.assign(new TypeError("EPROTO: The TLS handshake failed."), { code: "EPROTO" });
}

async function createDecisionAsync(client: OpenRouter): Promise<DecisionsResponse> {
	return client.alpha.decisions.create(
		{ decisionsRequest: { model: "test-model", questions: {}, state: {} } },
		createOpenRouterRequestOptions(),
	);
}

describe("openRouter retry options", () => {
	it("retries rate limits and server errors until a request succeeds", async ({ expect, onTestFinished }) => {
		expect.assertions(2);

		vi.useFakeTimers();
		onTestFinished(() => {
			vi.useRealTimers();
			vi.unstubAllGlobals();
		});
		const seen = new Array<ScriptedStep>();
		const pending = createDecisionAsync(createScriptedClient([429, 503, 429, 200], seen));
		await vi.runAllTimersAsync();

		await expect(pending).resolves.toMatchObject({ model: "test-model" });
		expect(seen).toStrictEqual([429, 503, 429, 200]);
	});

	it("keeps retrying a rate limit for minutes, then rejects with it", async ({ expect, onTestFinished }) => {
		expect.assertions(2);

		vi.useFakeTimers();
		onTestFinished(() => {
			vi.useRealTimers();
			vi.unstubAllGlobals();
		});
		const startedAt = Date.now();
		const seen = new Array<ScriptedStep>();
		const pending = createDecisionAsync(createScriptedClient([429], seen));
		const rejection = expect(pending).rejects.toBeInstanceOf(TooManyRequestsResponseError);
		await vi.runAllTimersAsync();

		await rejection;

		expect(Date.now() - startedAt).toBeGreaterThanOrEqual(3 * 60_000);
	});

	it("does not retry a client error", async ({ expect, onTestFinished }) => {
		expect.assertions(2);

		vi.useFakeTimers();
		onTestFinished(() => {
			vi.useRealTimers();
			vi.unstubAllGlobals();
		});
		const seen = new Array<ScriptedStep>();
		const pending = createDecisionAsync(createScriptedClient([400, 200], seen));
		const rejection = expect(pending).rejects.toThrow("HTTP 400");
		await vi.runAllTimersAsync();

		await rejection;

		expect(seen).toStrictEqual([400]);
	});

	it("retries a failed TLS handshake until a request succeeds", async ({ expect, onTestFinished }) => {
		expect.assertions(2);

		vi.useFakeTimers();
		onTestFinished(() => {
			vi.useRealTimers();
			vi.unstubAllGlobals();
		});
		const seen = new Array<ScriptedStep>();
		const steps = [createTlsHandshakeError(), createTlsHandshakeError(), 200];
		const pending = createDecisionAsync(createScriptedClient(steps, seen));
		await vi.runAllTimersAsync();

		await expect(pending).resolves.toMatchObject({ model: "test-model" });
		expect(seen).toStrictEqual(steps);
	});

	it("keeps retrying a network failure for minutes, then shows its cause", async ({ expect, onTestFinished }) => {
		expect.assertions(4);

		vi.useFakeTimers();
		onTestFinished(() => {
			vi.useRealTimers();
			vi.unstubAllGlobals();
		});
		const startedAt = Date.now();
		const failure = createTlsHandshakeError();
		const seen = new Array<ScriptedStep>();
		const pending = createDecisionAsync(createScriptedClient([failure], seen));
		const causeRejection = expect(pending).rejects.toHaveProperty("cause.cause", failure);
		const messageRejection = expect(pending).rejects.toThrow("EPROTO: The TLS handshake failed.");
		await vi.runAllTimersAsync();

		await causeRejection;
		await messageRejection;

		expect(seen.length).toBeGreaterThan(2);
		expect(Date.now() - startedAt).toBeGreaterThanOrEqual(3 * 60_000);
	});

	it("does not retry an aborted request", async ({ expect, onTestFinished }) => {
		expect.assertions(2);

		vi.useFakeTimers();
		onTestFinished(() => {
			vi.useRealTimers();
			vi.unstubAllGlobals();
		});
		const seen = new Array<ScriptedStep>();
		const abort = new DOMException("The operation was aborted.", "AbortError");
		const pending = createDecisionAsync(createScriptedClient([abort, 200], seen));
		const rejection = expect(pending).rejects.toBeInstanceOf(RequestAbortedError);
		await vi.runAllTimersAsync();

		await rejection;

		expect(seen).toStrictEqual([abort]);
	});
});

describe("openRouter relation adapters", () => {
	it.for([
		{ "0": 0.93, "1": 0.05, "2": 0.01 },
		{ "0": 0.93, "1": 0.06, "2": 0.02 },
	] as const)("preserves API probabilities rounded to two decimal places: %j", async (probabilities, { expect }) => {
		expect.assertions(1);

		const transport = createOpenRouterDecisionTransport(async () => ({
			answers: { assessment: { probabilities, score: 0.08, type: "score" } },
		}));
		const answers = await transport.decide({ model: "test", questions: {}, state: noPrintCard });

		expect(answers.assessment).toMatchObject({ probabilities });
	});

	it.for([
		{ probabilities: { "0": 0.1, "1": 0.1, "2": 1.2 }, score: 2, type: "score" },
		{ probabilities: { "0": 0.2, "1": 0.2, "2": 0.2 }, score: 1, type: "score" },
		{ probabilities: { "0": 0.2, "1": 0.8 }, score: 1, type: "score" },
		{ noul: -0.1, type: "noul" },
		{ noul: 1.1, type: "noul" },
	] as const)("rejects malformed probability evidence: %j", async (answer, { expect }) => {
		expect.assertions(1);

		const transport = createOpenRouterDecisionTransport(async () => ({ answers: { assessment: answer } }));

		await expect(transport.decide({ model: "test", questions: {}, state: noPrintCard })).rejects.toThrow(TypeError);
	});

	it("returns score distributions and noul answers from the Decisions API", async ({ expect }) => {
		expect.assertions(3);

		let requestedModel: string | undefined;
		const usage = new Array<RelationUsage>();
		const transport = createOpenRouterDecisionTransport(
			async (request) => {
				requestedModel = request.decisionsRequest.model;
				return {
					answers: {
						assessment: { probabilities: { "0": 0.02, "1": 0.08, "2": 0.9 }, score: 1.88, type: "score" },
						overlaps: { noul: 0.1, type: "noul" },
					},
					usage: { cost: 0.012, inputTokens: 100, outputTokens: 20 },
				};
			},
			(update) => {
				usage.push(update);
			},
		);
		const answers = await transport.decide({
			model: "~typesafe/jev-latest",
			questions: {
				assessment: {
					criteria: ["Unrelated", "Review", "Publish"],
					instructions: { candidate: noWarnCard, question: "Should these be linked?" },
					type: "score",
				},
				overlaps: {
					criteria: { false: "Different concerns.", true: "Same concern." },
					instructions: { candidate: noWarnCard, question: "Are these related?" },
					type: "noul",
				},
			},
			state: noPrintCard,
		});

		expect(requestedModel).toBe("~typesafe/jev-latest");
		expect(answers).toMatchObject({
			assessment: { probabilities: { "0": 0.02, "1": 0.08, "2": 0.9 }, score: 1.88 },
			overlaps: { noul: 0.1 },
		});
		expect(usage).toStrictEqual([
			{ cost: 0.012, inputTokens: 100, outputTokens: 20, phase: "judgments", totalTokens: 120 },
		]);
	});

	it("rejects a score without its publication probabilities", async ({ expect }) => {
		expect.assertions(1);

		const transport = createOpenRouterDecisionTransport(async () => ({
			answers: { exists__no_warn: { type: "score", value: 0.9 } },
		}));

		await expect(transport.decide({ model: "test", questions: {}, state: noPrintCard })).rejects.toThrow(TypeError);
	});

	it("uses the configured reason model and returns trimmed text", async ({ expect }) => {
		expect.assertions(3);

		let requestedModel = "";
		const usage = new Array<RelationUsage>();
		const writer = createOpenRouterReasonWriter(
			"anthropic/claude-sonnet-5",
			async (request) => {
				requestedModel = request.chatRequest.model;
				return {
					choices: [{ message: { content: "  Both rules replace Roblox logging globals.  " } }],
					usage: { completionTokens: 8, cost: 0.003, promptTokens: 40, totalTokens: 48 },
				};
			},
			(update) => {
				usage.push(update);
			},
		);
		const reason = await writer.writeReason({
			left: noPrintCard,
			relation: {
				from: "no-print" satisfies RuleName,
				kind: "related",
				to: "no-warn" satisfies RuleName,
			},
			right: noWarnCard,
		});

		expect(requestedModel).toBe("anthropic/claude-sonnet-5");
		expect(reason).toBe("Both rules replace Roblox logging globals.");
		expect(usage).toStrictEqual([
			{ cost: 0.003, inputTokens: 40, outputTokens: 8, phase: "reasons", totalTokens: 48 },
		]);
	});

	it("sends a rejected attempt back to the reason model", async ({ expect }) => {
		expect.assertions(1);

		let prompt = "";
		const writer = createOpenRouterReasonWriter("test-reason-model", async (request) => {
			prompt = request.chatRequest.messages.map((message) => message.content).join("\n");
			return { choices: [{ message: { content: "Shorter." } }] };
		});

		await writer.writeReason({
			left: noPrintCard,
			previous: { problems: ["Reason is empty."], reason: "" },
			relation: {
				from: "no-print" satisfies RuleName,
				kind: "related",
				to: "no-warn" satisfies RuleName,
			},
			right: noWarnCard,
		});

		expect(prompt).toContain("Reason is empty.");
	});
});
