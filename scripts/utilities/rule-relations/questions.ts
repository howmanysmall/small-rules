import { JudgmentDimension, judgmentDimensions } from "./types";

import type { RuleName } from "$data/rule-manifest";

import type { DecisionAnswer, DecisionQuestion, NoulQuestion, PairJudgments, RuleCard, ScoreAnswer } from "./types";

interface QuestionDefinition {
	readonly criteria: { readonly false: string; readonly true: string };
	readonly instructions: string;
}

const questionDefinitions = {
	backwardReplaces: {
		criteria: {
			false: "The state rule still catches realistic cases the candidate permits, or the evidence does not establish full coverage.",
			true: "Following the candidate makes every violation of the state rule impossible on the state rule's documented surface, including its exceptions and options.",
		},
		instructions:
			"Assuming a useful relationship exists, does `candidate` supersede `state`? Judge behavioral coverage from the supplied evidence, not shared names or implementation utilities.",
	},
	backwardRequires: {
		criteria: {
			false: "The candidate is useful on its own, or the state rule's practice is unrelated to it.",
			true: "The candidate's recommended change needs the practice the state rule enforces. This is a prerequisite, not just a complementary benefit.",
		},
		instructions:
			"Assuming a useful relationship exists, does `candidate` depend on the practice `state` enforces? Enabling the other lint rule itself need not be mandatory.",
	},
	duplicates: {
		criteria: {
			false: "The rules flag different constructs or different locations; both can be enabled without duplicate reports.",
			true: "Realistic code can violate both rules at the same location, producing duplicate diagnostics.",
		},
		instructions:
			"Can the rule described in `state` and `candidate` both flag the same piece of code, so enabling both would report the same problem twice?",
	},
	forwardReplaces: {
		criteria: {
			false: "The candidate still catches realistic cases the state rule permits, or the evidence does not establish full coverage.",
			true: "Following the state rule makes every violation of the candidate impossible on the candidate's documented surface, including its exceptions and options.",
		},
		instructions:
			"Assuming a useful relationship exists, does `state` supersede `candidate`? Judge behavioral coverage from the supplied evidence, not shared names or implementation utilities.",
	},
	forwardRequires: {
		criteria: {
			false: "The state rule is useful on its own, or the candidate's practice is unrelated to it.",
			true: "The state rule's recommended change needs the practice the candidate enforces. This is a prerequisite, not just a complementary benefit.",
		},
		instructions:
			"Assuming a useful relationship exists, does `state` depend on the practice `candidate` enforces? Enabling the other lint rule itself need not be mandatory.",
	},
} satisfies Record<JudgmentDimension, QuestionDefinition>;

export function getJudgmentQuestionId(dimension: "assessment" | JudgmentDimension, candidateName: string): string {
	return `${dimension}__${candidateName}`;
}

function createQuestion(dimension: JudgmentDimension, candidate: RuleCard): NoulQuestion {
	const definition = questionDefinitions[dimension];
	return {
		criteria: definition.criteria,
		instructions: { candidate, question: definition.instructions },
		type: "noul",
	};
}

export function createPairJudgmentQuestions(
	candidates: ReadonlyArray<RuleCard>,
): Readonly<Record<string, DecisionQuestion>> {
	const questions: Record<string, DecisionQuestion> = {};
	for (const candidate of candidates) {
		questions[getJudgmentQuestionId("assessment", candidate.name)] = {
			criteria: [
				"Unrelated: the evidence shows independent concerns. Sharing a category, framework, vocabulary, or helper alone is not a useful documentation relationship.",
				"Needs review: a useful relationship is plausible, but the supplied behavior, examples, exceptions, or options leave it unclear or contradictory.",
				"Publish: the evidence establishes a concrete relationship useful when configuring these rules: complementary halves of the same practice, duplicate diagnostics, supersession, or a prerequisite.",
			],
			instructions: {
				candidate,
				question:
					"How well does the supplied evidence support linking `state` and `candidate` on their documentation pages? Evaluate this unordered pair as a whole. Use documented behavior and examples; do not invent missing behavior. Choose the review level when evidence is insufficient. A useful complementary relationship can qualify for publication without overlap or dependency.",
			},
			type: "score",
		};

		for (const dimension of judgmentDimensions) {
			questions[getJudgmentQuestionId(dimension, candidate.name)] = createQuestion(dimension, candidate);
		}
	}

	return questions satisfies Readonly<Record<string, DecisionQuestion>>;
}

function getNoulAnswer(answers: Readonly<Record<string, DecisionAnswer>>, questionId: string): number {
	const answer = answers[questionId];
	if (answer?.type !== "noul") {
		throw new TypeError(`Missing or invalid noul answer for "${questionId}".`);
	}

	return answer.noul;
}

function getScoreAnswer(answers: Readonly<Record<string, DecisionAnswer>>, questionId: string): ScoreAnswer {
	const answer = answers[questionId];
	if (answer?.type !== "score") {
		throw new TypeError(`Missing or invalid score answer for "${questionId}".`);
	}

	return answer;
}

export function interpretJudgmentAnswers(
	answers: Readonly<Record<string, DecisionAnswer>>,
	candidates: ReadonlyArray<RuleCard>,
): ReadonlyMap<RuleName, PairJudgments> {
	const judgments = new Map<RuleName, PairJudgments>();
	for (const candidate of candidates) {
		const backwardReplaces = getNoulAnswer(
			answers,
			getJudgmentQuestionId(JudgmentDimension.BackwardReplaces, candidate.name),
		);

		const backwardRequires = getNoulAnswer(
			answers,
			getJudgmentQuestionId(JudgmentDimension.BackwardRequires, candidate.name),
		);

		const forwardReplaces = getNoulAnswer(
			answers,
			getJudgmentQuestionId(JudgmentDimension.ForwardReplaces, candidate.name),
		);

		const forwardRequires = getNoulAnswer(
			answers,
			getJudgmentQuestionId(JudgmentDimension.ForwardRequires, candidate.name),
		);

		judgments.set(candidate.name, {
			assessment: getScoreAnswer(answers, getJudgmentQuestionId("assessment", candidate.name)),
			backwardReplaces,
			backwardRequires,
			duplicates: getNoulAnswer(answers, getJudgmentQuestionId(JudgmentDimension.Duplicates, candidate.name)),
			forwardReplaces,
			forwardRequires,
		});
	}
	return judgments;
}
