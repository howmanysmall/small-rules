import { describe, expect, it } from "vitest";

import noPrint from "$oxc-rules/roblox/no-print";
import { createRule } from "$oxc-utilities/create-rule";

import type { CreateRule } from "oxlint-plugin-utilities";

function makeExampleRule(): CreateRule {
	return {
		create: () => ({}),
		meta: {
			docs: { description: "Keeps its description." },
			messages: { issue: "Example message." },
			type: "problem",
		},
	};
}

describe("createRule", () => {
	// Catches a rule's diagnostics linking to a 404.
	it("publishes the documented docs URL for a registered rule", () => {
		expect.assertions(1);

		expect(noPrint.meta?.docs?.url).toBe("https://docs.howmanysmall.com/small-rules/rules/roblox/no-print/");
	});

	it("adds the docs URL without discarding the description", () => {
		expect.assertions(2);

		const decorated = createRule("example-rule", "general", makeExampleRule());

		expect(decorated.meta?.docs?.url).toBe("https://docs.howmanysmall.com/small-rules/rules/general/example-rule/");
		expect(decorated.meta?.docs?.description).toBe("Keeps its description.");
	});

	// Catches registering a bare rule (meta is optional) crashing the plugin.
	it("returns a rule without meta unchanged", () => {
		expect.assertions(2);

		const bare: CreateRule = { create: () => ({}) };
		const decorated = createRule("example-rule", "general", bare);

		expect(decorated.meta).toBeUndefined();
		expect(decorated.create).toBeTypeOf("function");
	});

	// Catches decorating one rule mutating the shared module object.
	it("does not mutate the rule it decorates", () => {
		expect.assertions(1);

		const original = makeExampleRule();
		createRule("example-rule", "general", original);

		expect(original.meta?.docs?.url).toBeUndefined();
	});
});
