import { describe, expect, it } from "vitest";

import { appendRulePageSections, findRuleNameByPath, getRulePageSections } from "$data/rule-page-sections";

describe("getRulePageSections", () => {
	it("lists every section a rule page renders, in page order", () => {
		expect.assertions(1);

		expect(getRulePageSections("no-print", { hasRationale: true }).map((section) => section.text)).toStrictEqual([
			"Rationale",
			"Diagnostic Messages",
			"Configuration",
			"Examples",
			"Related Rules",
		]);
	});

	it("leaves out the rationale when the page does not write one", () => {
		expect.assertions(1);

		expect(getRulePageSections("no-print", { hasRationale: false }).map((section) => section.slug)).not.toContain(
			"rationale",
		);
	});

	it("leaves out related rules when the rule has none", () => {
		expect.assertions(1);

		expect(
			getRulePageSections("array-type-generic", { hasRationale: false }).map((section) => section.slug),
		).not.toContain("related-rules");
	});
});

describe("findRuleNameByPath", () => {
	it("finds the rule a docs entry documents", () => {
		expect.assertions(1);

		expect(findRuleNameByPath("rules/roblox/no-print")).toBe("no-print");
	});

	it("returns undefined for pages that are not rule pages", () => {
		expect.assertions(1);

		expect(findRuleNameByPath("quick-start")).toBeUndefined();
	});
});

describe("appendRulePageSections", () => {
	it("adds the sections after the overview as top-level entries", () => {
		expect.assertions(1);

		const items = appendRulePageSections(
			[{ children: [], depth: 2, slug: "_top", text: "Overview" }],
			[{ slug: "examples", text: "Examples" }],
		);

		expect(items).toStrictEqual([
			{ children: [], depth: 2, slug: "_top", text: "Overview" },
			{ children: [], depth: 2, slug: "examples", text: "Examples" },
		]);
	});

	it("does not repeat a section the page already lists", () => {
		expect.assertions(1);

		const items = appendRulePageSections(
			[
				{ children: [], depth: 2, slug: "_top", text: "Overview" },
				{ children: [], depth: 2, slug: "examples", text: "Examples" },
			],
			[{ slug: "examples", text: "Examples" }],
		);

		expect(items).toHaveLength(2);
	});
});
