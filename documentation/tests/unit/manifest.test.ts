import { describe, it } from "vitest";

import { ruleManifest } from "$data/rule-manifest";
import smallRules from "$small-rules";

function getManifestRuleNames(): ReadonlyArray<string> {
	return ruleManifest.categories.flatMap((category) => category.rules.map((entry) => entry.name));
}

describe("rule manifest integrity", () => {
	it("derives every documented rule from the plugin", ({ expect }) => {
		expect.assertions(1);

		// biome-ignore lint/suspicious/useArraySortCompare: no lol
		expect(getManifestRuleNames().toSorted()).toStrictEqual(Object.keys(smallRules.rules).toSorted());
	});

	it("registers each rule exactly once", ({ expect }) => {
		expect.assertions(1);

		const names = getManifestRuleNames();

		expect(new Set(names).size).toBe(names.length);
	});

	it("keeps category keys unique", ({ expect }) => {
		expect.assertions(1);

		const keys = ruleManifest.categories.map((category) => category.key);

		expect(new Set(keys).size).toBe(keys.length);
	});

	const allCategoriesForEach = ruleManifest.categories.map(
		(category) => [category.key, category.description, category.label] as const,
	);

	it.for(allCategoriesForEach)("keeps category %s unique", ([key, description, label], { expect }) => {
		expect.assertions(2);

		expect(description.trim(), `${key} description`).not.toBe("");
		expect(label.trim(), `${key} label`).not.toBe("");
	});
});
