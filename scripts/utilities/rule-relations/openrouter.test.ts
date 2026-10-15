import { describe, expect, it } from "vitest";

import {
	createOpenRouterDecisionTransport,
	createOpenRouterReasonWriter,
} from "$script-utilities/rule-relations/openrouter";

import type { RuleName } from "$data/rule-manifest";
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

describe("openRouter relation adapters", () => {
	it.each([
		{ "0": 0.93, "1": 0.05, "2": 0.01 },
		{ "0": 0.93, "1": 0.06, "2": 0.02 },
	])("preserves API probabilities rounded to two decimal places: %j", async (probabilities) => {
		expect.assertions(1);

		const transport = createOpenRouterDecisionTransport(async () => ({
			answers: { assessment: { probabilities, score: 0.08, type: "score" } },
		}));
		const answers = await transport.decide({ model: "test", questions: {}, state: noPrintCard });

		expect(answers.assessment).toMatchObject({ probabilities });
	});

	it.each([
		{ probabilities: { "0": 0.1, "1": 0.1, "2": 1.2 }, score: 2, type: "score" },
		{ probabilities: { "0": 0.2, "1": 0.2, "2": 0.2 }, score: 1, type: "score" },
		{ probabilities: { "0": 0.2, "1": 0.8 }, score: 1, type: "score" },
		{ noul: -0.1, type: "noul" },
		{ noul: 1.1, type: "noul" },
	])("rejects malformed probability evidence: %j", async (answer) => {
		expect.assertions(1);

		const transport = createOpenRouterDecisionTransport(async () => ({ answers: { assessment: answer } }));

		await expect(transport.decide({ model: "test", questions: {}, state: noPrintCard })).rejects.toThrow(TypeError);
	});

	it("returns score distributions and noul answers from the Decisions API", async () => {
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

	it("rejects a score without its publication probabilities", async () => {
		expect.assertions(1);

		const transport = createOpenRouterDecisionTransport(async () => ({
			answers: { exists__no_warn: { type: "score", value: 0.9 } },
		}));

		await expect(transport.decide({ model: "test", questions: {}, state: noPrintCard })).rejects.toThrow(TypeError);
	});

	it("uses the configured reason model and returns trimmed text", async () => {
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
});
