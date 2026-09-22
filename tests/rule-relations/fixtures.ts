import type { PairJudgments } from "$script-utilities/rule-relations/types";

export function createJudgments(overrides: Partial<PairJudgments> = {}): PairJudgments {
	return {
		assessment: { probabilities: { "0": 0.02, "1": 0.08, "2": 0.9 }, score: 1.88, type: "score" },
		backwardReplaces: 0,
		backwardRequires: 0,
		duplicates: 0,
		forwardReplaces: 0,
		forwardRequires: 0,
		...overrides,
	};
}
