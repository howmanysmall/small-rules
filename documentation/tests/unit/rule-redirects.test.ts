import { describe, expect, it } from "vitest";

import { ruleManifest } from "$data/rule-manifest";
import { createRuleRedirects, ruleRedirects } from "$data/rule-redirects";

import type { RuleManifest } from "$data/rule-manifest";

const fixtureManifest = {
	categories: [
		{
			key: "english",
			description: "English rules.",
			label: "English",
			rules: [{ name: "prevent-abbreviations", movedFrom: ["naming", "general"] }, { name: "starts-with-verb" }],
		},
		{
			key: "roblox",
			description: "Roblox rules.",
			label: "Roblox",
			rules: [{ name: "no-print" }],
		},
	],
} satisfies RuleManifest;

describe("createRuleRedirects", () => {
	it("redirects every previous category path to the current rule path", () => {
		expect.assertions(1);

		expect(createRuleRedirects(fixtureManifest, "/small-rules")).toStrictEqual({
			"/rules/general/prevent-abbreviations": "/small-rules/rules/english/prevent-abbreviations/",
			"/rules/naming/prevent-abbreviations": "/small-rules/rules/english/prevent-abbreviations/",
		});
	});

	it("creates no redirects for rules that never moved", () => {
		expect.assertions(1);

		const unmovedManifest = {
			categories: [
				{ key: "roblox", description: "Roblox rules.", label: "Roblox", rules: [{ name: "no-print" }] },
			],
		} satisfies RuleManifest;

		expect(createRuleRedirects(unmovedManifest, "/small-rules")).toStrictEqual({});
	});
});

describe("ruleRedirects", () => {
	it("keeps the old naming links for rules moved to the English category", () => {
		expect.assertions(3);

		expect(ruleRedirects["/rules/naming/consistent-compound-words"]).toBe(
			"/small-rules/rules/english/consistent-compound-words/",
		);
		expect(ruleRedirects["/rules/naming/prefer-singular-enums"]).toBe(
			"/small-rules/rules/english/prefer-singular-enums/",
		);
		expect(ruleRedirects["/rules/naming/prevent-abbreviations"]).toBe(
			"/small-rules/rules/english/prevent-abbreviations/",
		);
	});

	it("never redirects away from a page that still exists", () => {
		expect.assertions(1);

		const currentPaths = ruleManifest.categories.flatMap((category) =>
			category.rules.map((entry) => `/rules/${category.key}/${entry.name}`),
		);

		expect(currentPaths.filter((path) => path in ruleRedirects)).toStrictEqual([]);
	});
});
