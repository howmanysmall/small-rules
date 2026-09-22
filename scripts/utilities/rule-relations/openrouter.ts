import { isNumber, isString } from "@small-rules/arktype-utilities";
import { type } from "arktype";

import { createReasonMessages } from "./reasons";

import type { DecisionsRequest } from "@openrouter/sdk/models";
import type {
	CreateApiAlphaDecisionsRequest,
	SendChatCompletionRequestRequest,
} from "@openrouter/sdk/models/operations";

import type { DecisionTransport, NoulAnswer, NoulQuestion, ReasonWriter } from "./types";

interface DecisionApiResponse {
	readonly answers: unknown;
}

interface ReasonApiRequest extends SendChatCompletionRequestRequest {
	readonly chatRequest: SendChatCompletionRequestRequest["chatRequest"] & {
		readonly model: string;
		readonly stream: false;
	};
}

type CreateDecisionAsync = (request: CreateApiAlphaDecisionsRequest) => Promise<DecisionApiResponse>;
type SendChatAsync<TResult> = (request: ReasonApiRequest) => Promise<TResult>;

const isNoulAnswersResponse = type({
	answers: {
		"[string]": { noul: isNumber, type: "'noul'" },
	},
});

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

function toDecisionQuestion(question: NoulQuestion): DecisionsRequest["questions"][string] {
	return {
		criteria: question.criteria,
		instructions: {
			candidate: { ...question.instructions.candidate },
			question: question.instructions.question,
		},
		type: "noul",
	};
}

function toDecisionQuestions(questions: Readonly<Record<string, NoulQuestion>>): DecisionsRequest["questions"] {
	return Object.fromEntries(Object.entries(questions).map(([key, question]) => [key, toDecisionQuestion(question)]));
}

export function createOpenRouterDecisionTransport(createDecisionAsync: CreateDecisionAsync): DecisionTransport {
	return {
		decide: async (options): Promise<Readonly<Record<string, NoulAnswer>>> => {
			const response = await createDecisionAsync({
				decisionsRequest: {
					model: options.model,
					questions: toDecisionQuestions(options.questions),
					state: { ...options.state },
				},
			});
			const parsed = isNoulAnswersResponse(response);
			if (parsed instanceof type.errors) {
				throw new TypeError(`OpenRouter Decisions returned a non-noul answer: ${parsed.summary}`);
			}
			return parsed.answers;
		},
	};
}

export function createOpenRouterReasonWriter<TResult>(
	reasonModel: string,
	sendChatAsync: SendChatAsync<TResult>,
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
			const parsed = isReasonResponse(response);
			if (parsed instanceof type.errors) {
				throw new TypeError("OpenRouter returned no textual relation reason.");
			}
			const [choice] = parsed.choices;
			if (choice === undefined) throw new TypeError("OpenRouter returned no textual relation reason.");
			return choice.message.content.trim();
		},
	};
}
