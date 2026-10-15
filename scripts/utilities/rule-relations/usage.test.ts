import { describe, expect, it } from "vitest";

import { createRelationUsageTracker, formatRelationRunSummary } from "$script-utilities/rule-relations/usage";

describe("relation generation usage", () => {
	it("reports API usage, cache reuse, cost, and elapsed time", () => {
		expect.assertions(1);

		const tracker = createRelationUsageTracker();
		tracker.record({ cost: 0.012, inputTokens: 100, outputTokens: 20, phase: "judgments", totalTokens: 120 });
		tracker.record({ cost: 0.003, inputTokens: 40, outputTokens: 8, phase: "reasons", totalTokens: 48 });

		expect(
			formatRelationRunSummary({
				elapsedMilliseconds: 194_000,
				progress: {
					judgments: { cached: 12_000, completed: 15_500, phase: "judgments", total: 15_500 },
					reasons: { cached: 10, completed: 47, phase: "reasons", total: 47 },
				},
				usage: tracker.getTotals(),
			}),
		).toStrictEqual([
			"usage: 2 API requests (1 judgments, 1 reasons), 140 input tokens, 28 output tokens, 168 total tokens",
			"reported cost: $0.015000 (2/2 requests)",
			"cache: 12,000/15,500 judgments, 10/47 reasons",
			"elapsed: 3m 14s",
		]);
	});
});
