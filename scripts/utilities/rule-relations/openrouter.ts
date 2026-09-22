import { isString } from "@small-rules/arktype-utilities";
import { type } from "arktype";

import { createReasonMessages } from "./reasons";
import { isNoulAnswer, isScoreAnswer } from "./types";

import type { DecisionsRequest } from "@openrouter/sdk/models";
import type {
	CreateApiAlphaDecisionsRequest,
	SendChatCompletionRequestRequest,
} from "@openrouter/sdk/models/operations";

import type { DecisionAnswer, DecisionQuestion, DecisionTransport, ReasonWriter, RelationUsage } from "./types";

interface DecisionApiResponse {
	readonly answers: unknown;
	readonly usage?:
		| undefined
		| {
				readonly cost?: number | undefined;
				readonly inputTokens: number;
				readonly outputTokens: number;
		  };
}

interface ReasonApiResponse {
	readonly choices: unknown;
	readonly usage?:
		| undefined
		| {
				readonly completionTokens: number;
				readonly cost?: null | number | undefined;
				readonly promptTokens: number;
				readonly totalTokens: number;
		  };
}

interface ReasonApiRequest extends SendChatCompletionRequestRequest {
	readonly chatRequest: SendChatCompletionRequestRequest["chatRequest"] & {
		readonly model: string;
		readonly stream: false;
	};
}

type CreateDecisionAsync = (request: CreateApiAlphaDecisionsRequest) => Promise<DecisionApiResponse>;
type SendChatAsync = (request: ReasonApiRequest) => Promise<ReasonApiResponse>;
type OnUsage = (usage: RelationUsage) => void;

const isDecisionAnswersResponse = type({
	"+": "delete",
	answers: type.Record(isString, isNoulAnswer.or(isScoreAnswer)).readonly(),
}).readonly();

const isReasonMessage = type({
	"+": "delete",
	content: isString,
}).readonly();
const isReasonChoice = type({
	"+": "delete",
	message: isReasonMessage,
}).readonly();
const isReasonResponse = type({
	"+": "delete",
	choices: isReasonChoice.array().readonly(),
}).readonly();

function toDecisionQuestion(question: DecisionQuestion): DecisionsRequest["questions"][string] {
	const instructions = {
		candidate: { ...question.instructions.candidate },
		question: question.instructions.question,
	};

	return question.type === "score"
		? { criteria: [...question.criteria], instructions, type: "score" }
		: { criteria: question.criteria, instructions, type: "noul" };
}

function toDecisionQuestions(questions: Readonly<Record<string, DecisionQuestion>>): DecisionsRequest["questions"] {
	return Object.fromEntries(Object.entries(questions).map(([key, question]) => [key, toDecisionQuestion(question)]));
}

export function createOpenRouterDecisionTransport(
	createDecisionAsync: CreateDecisionAsync,
	onUsage?: OnUsage,
): DecisionTransport {
	return {
		decide: async (options): Promise<Readonly<Record<string, DecisionAnswer>>> => {
			const response = await createDecisionAsync({
				decisionsRequest: {
					model: options.model,
					questions: toDecisionQuestions(options.questions),
					state: { ...options.state },
				},
			});

			onUsage?.({
				cost: response.usage?.cost,
				inputTokens: response.usage?.inputTokens,
				outputTokens: response.usage?.outputTokens,
				phase: "judgments",
				totalTokens:
					response.usage === undefined ? undefined : response.usage.inputTokens + response.usage.outputTokens,
			});

			const parsed = isDecisionAnswersResponse(response);
			if (parsed instanceof type.errors) {
				throw new TypeError(`OpenRouter Decisions returned an invalid judgment: ${parsed.summary}`);
			}

			return parsed.answers;
		},
	};
}

export function createOpenRouterReasonWriter(
	reasonModel: string,
	sendChatAsync: SendChatAsync,
	onUsage?: OnUsage,
): ReasonWriter {
	return {
		writeReason: async (options): Promise<string> => {
			const response = await sendChatAsync({
				chatRequest: {
					messages: [...createReasonMessages(options)],
					model: reasonModel,
					stream: false,
					temperature: 0,
				},
			});

			onUsage?.({
				cost: response.usage?.cost ?? undefined,
				inputTokens: response.usage?.promptTokens,
				outputTokens: response.usage?.completionTokens,
				phase: "reasons",
				totalTokens: response.usage?.totalTokens,
			});

			const parsed = isReasonResponse(response);
			if (parsed instanceof type.errors) {
				throw new TypeError("OpenRouter returned no textual relation reason.");
			}

			const [choice] = parsed.choices;
			if (choice === undefined) {
				throw new TypeError("OpenRouter returned no textual relation reason.");
			}

			return choice.message.content.trim();
		},
	};
}
