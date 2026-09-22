import { JudgmentDimension, judgmentDimensions } from "./types";

import type { RuleName } from "$data/rule-manifest";

import type { NoulAnswer, NoulQuestion, PairJudgments, RuleCard } from "./types";

interface QuestionDefinition {
	readonly criteria: { readonly false: string; readonly true: string };
	readonly instructions: string;
}

const questionDefinitions = {
	duplicates: {
		criteria: {
			false: "The rules flag different constructs or different locations; both can be enabled without duplicate reports.",
			true: "Realistic code can violate both rules at the same location, producing duplicate diagnostics.",
		},
		instructions:
			"Can the rule described in `state` and `candidate` both flag the same piece of code, so enabling both would report the same problem twice?",
	},
	exists: {
		criteria: {
			false: "The rules merely share a category, framework, or generic TypeScript/React vocabulary; same-category adjacency alone is never a relation.",
			true: "The rules address the same problem family, cover complementary halves of one practice, or configuring one changes how the other should be understood or configured.",
		},
		instructions:
			"Would someone configuring the rule described in `state` benefit from also seeing `candidate` linked as a related rule on its documentation page?",
	},
	replaces: {
		criteria: {
			false: "The candidate catches cases the state rule does not, or the two rules are independent.",
			true: "The state rule's requirement covers the candidate's subject matter thoroughly enough that the candidate would never fire once the state rule is enforced.",
		},
		instructions:
			"Would enabling the rule described in `state` largely make `candidate` redundant for the surface `candidate` covers?",
	},
	requires: {
		criteria: {
			false: "The state rule is useful on its own, or the candidate's practice is unrelated to it.",
			true: "The state rule's recommended change only pays off, or only makes sense, after the candidate's requirement is satisfied.",
		},
		instructions:
			"Is the rule described in `state` only useful once the practice `candidate` enforces is already in place?",
	},
} satisfies Record<JudgmentDimension, QuestionDefinition>;

export function getJudgmentQuestionId(dimension: JudgmentDimension, candidateName: string): string {
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
): Readonly<Record<string, NoulQuestion>> {
	const questions: Record<string, NoulQuestion> = {};
	for (const candidate of candidates) {
		for (const dimension of judgmentDimensions) {
			questions[getJudgmentQuestionId(dimension, candidate.name)] = createQuestion(dimension, candidate);
		}
	}
	return questions satisfies Readonly<Record<string, NoulQuestion>>;
}

function getNoulAnswer(answers: Readonly<Record<string, NoulAnswer>>, questionId: string): number {
	const answer = answers[questionId];
	if (answer === undefined) throw new Error(`Missing answer for "${questionId}".`);
	return answer.noul;
}

export function interpretJudgmentAnswers(
	answers: Readonly<Record<string, NoulAnswer>>,
	candidates: ReadonlyArray<RuleCard>,
): ReadonlyMap<RuleName, PairJudgments> {
	const judgments = new Map<RuleName, PairJudgments>();
	for (const candidate of candidates) {
		judgments.set(candidate.name, {
			duplicates: getNoulAnswer(answers, getJudgmentQuestionId(JudgmentDimension.Duplicates, candidate.name)),
			exists: getNoulAnswer(answers, getJudgmentQuestionId(JudgmentDimension.Exists, candidate.name)),
			replaces: getNoulAnswer(answers, getJudgmentQuestionId(JudgmentDimension.Replaces, candidate.name)),
			requires: getNoulAnswer(answers, getJudgmentQuestionId(JudgmentDimension.Requires, candidate.name)),
		});
	}
	return judgments;
}
