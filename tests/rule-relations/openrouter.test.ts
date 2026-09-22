import { describe, expect, it } from "vitest";

import {
	createOpenRouterDecisionTransport,
	createOpenRouterReasonWriter,
} from "$script-utilities/rule-relations/openrouter";

import type { RuleName } from "$data/rule-manifest";
import type { RuleCard } from "$script-utilities/rule-relations/types";

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
	it("returns only noul answers from the Decisions API", async () => {
		expect.assertions(2);

		let requestedModel: string | undefined;
		const transport = createOpenRouterDecisionTransport(async (request) => {
			requestedModel = request.decisionsRequest.model;
			return { answers: { exists__no_warn: { noul: 0.9, type: "noul" } } };
		});
		const answers = await transport.decide({
			model: "~typesafe/jev-latest",
			questions: {
				exists__no_warn: {
					criteria: { false: "Different concerns.", true: "Same concern." },
					instructions: { candidate: noWarnCard, question: "Are these related?" },
					type: "noul",
				},
			},
			state: noPrintCard,
		});

		expect(requestedModel).toBe("~typesafe/jev-latest");
		expect(answers).toStrictEqual({ exists__no_warn: { noul: 0.9, type: "noul" } });
	});

	it("rejects a Decisions response containing another answer type", async () => {
		expect.assertions(1);

		const transport = createOpenRouterDecisionTransport(async () => ({
			answers: { exists__no_warn: { type: "score", value: 0.9 } },
		}));

		await expect(transport.decide({ model: "test", questions: {}, state: noPrintCard })).rejects.toThrow(
			"non-noul",
		);
	});

	it("uses the configured reason model and returns trimmed text", async () => {
		expect.assertions(2);

		let requestedModel = "";
		const writer = createOpenRouterReasonWriter("anthropic/claude-sonnet-5", async (request) => {
			requestedModel = request.chatRequest.model;
			return { choices: [{ message: { content: "  Both rules replace Roblox logging globals.  " } }] };
		});
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
	});
});
