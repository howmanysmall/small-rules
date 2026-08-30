import { describe, expect, it } from "vitest";

const DOCS_URL_PATTERN = /^https:\/\/docs\.howmanysmall\.com\/small-rules\/rules\/[a-z-]+\/[a-z0-9-]+\/$/u;
const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

interface RuleLike {
	readonly meta?: { readonly docs?: { readonly url?: string } };
}

function unconfigurableRuleNames<RuleEntry extends RuleLike>(rules: Record<string, RuleEntry>): Array<string> {
	return Object.keys(rules).filter((name) => !KEBAB_CASE_PATTERN.test(name));
}

function rulesWithoutDocsUrl<RuleEntry extends RuleLike>(rules: Record<string, RuleEntry>): Array<string> {
	return Object.entries(rules)
		.filter(([, rule]) => rule.meta?.docs?.url === undefined || !DOCS_URL_PATTERN.test(rule.meta.docs.url))
		.map(([name]) => name);
}

describe("small-rules plugin", () => {
	describe("plugin metadata", () => {
		it("has the correct plugin name", async () => {
			expect.assertions(1);

			const smallRules = await import("$small-rules");

			expect(smallRules.default.meta?.name).toBe("small-rules");
		}, 30_000);

		it("registers at least one rule", async () => {
			expect.assertions(1);

			const smallRules = await import("$small-rules");

			expect(Object.keys(smallRules.default.rules).length).toBeGreaterThan(0);
		}, 30_000);

		// Catches a rule registered under a name users cannot configure.
		it("registers every rule under a kebab-case name users can configure", async () => {
			expect.assertions(1);

			const smallRules = await import("$small-rules");

			expect(unconfigurableRuleNames(smallRules.default.rules)).toStrictEqual([]);
		}, 30_000);

		// Catches a rule bypassing createRule and shipping without a docs URL.
		it("advertises a docs URL on the documented docs site for every rule", async () => {
			expect.assertions(1);

			const smallRules = await import("$small-rules");

			expect(rulesWithoutDocsUrl(smallRules.default.rules)).toStrictEqual([]);
		}, 30_000);
	});
});
