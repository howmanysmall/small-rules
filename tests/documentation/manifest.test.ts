import { describe, expect, it } from "vitest";

import { ruleManifest } from "$data/rule-manifest";
import smallRules from "$small-rules";

function getManifestRuleNames(): ReadonlyArray<string> {
	return ruleManifest.categories.flatMap((category) => category.rules.map((entry) => entry.name));
}

describe("rule manifest integrity", () => {
	it("derives every documented rule from the plugin", () => {
		expect.assertions(1);

		expect(getManifestRuleNames().toSorted()).toStrictEqual(Object.keys(smallRules.rules).toSorted());
	});

	it("registers each rule exactly once", () => {
		expect.assertions(1);

		const names = getManifestRuleNames();

		expect(new Set(names).size).toBe(names.length);
	});

	it("keeps category keys unique", () => {
		expect.assertions(1);

		const keys = ruleManifest.categories.map((category) => category.key);

		expect(new Set(keys).size).toBe(keys.length);
	});

	const allCategoriesForEach = ruleManifest.categories.map((category) => [
		category.key,
		category.description,
		category.label,
	]);

	it.each(allCategoriesForEach)("keeps category %s unique", (key, description, label) => {
		expect.assertions(2);

		expect(description.trim(), `${key} description`).not.toBe("");
		expect(label.trim(), `${key} label`).not.toBe("");
	});
});
