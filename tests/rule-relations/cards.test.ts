import { describe, expect, it } from "vitest";

import { ruleManifest } from "$data/rule-manifest";
import { buildRuleCards } from "$script-utilities/rule-relations/rule-cards";

describe("buildRuleCards", () => {
	it("builds a card for every manifest rule", () => {
		expect.assertions(2);

		const cards = buildRuleCards();
		const manifestRuleCount = ruleManifest.categories.reduce((count, category) => count + category.rules.length, 0);

		expect(cards.size).toBe(manifestRuleCount);
		expect(cards.get("no-print")?.name).toBe("no-print");
	});

	it("captures the documented facts, examples, and rationale for no-print", () => {
		expect.assertions(5);

		const card = buildRuleCards().get("no-print");

		expect(card?.description).toBe("Use Log instead of print().");
		expect(card?.rationale).toContain("Log");
		expect(card?.examples[0]?.kind).toBe("invalid");
		expect(card?.examples[0]?.code).toContain("print(");
		expect(card?.examples.length).toBeLessThanOrEqual(4);
	});

	it("records shared utilities from rule sources", () => {
		expect.assertions(1);

		const card = buildRuleCards().get("no-print");

		expect(card?.sharedUtilities).toContain("banned-global-call-rule");
	});
});
