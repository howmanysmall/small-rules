import { describe, expect, it } from "vitest";

import smallRules from "$small-rules";

import { ruleManifest } from "../../documentation/src/data/rule-manifest";

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

	it("keeps every category label and description nonblank", () => {
		expect.assertions(ruleManifest.categories.length * 2);

		for (const category of ruleManifest.categories) {
			expect(category.description.trim(), `${category.key} description`).not.toBe("");
			expect(category.label.trim(), `${category.key} label`).not.toBe("");
		}
	});
});
