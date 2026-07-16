import { describe, expect, it } from "vitest";

import { getRuleOptionsDocumentation } from "../documentation/src/data/rule-options";

describe("rule options documentation", () => {
	it("keeps primitive defaults inline", () => {
		expect.assertions(1);

		// Given
		const documentation = getRuleOptionsDocumentation("require-named-effect-functions");

		// When
		const environment = documentation.options.find((option) => option.name === "environment");

		// Then
		expect(environment?.defaultValue).toStrictEqual({
			displayValue: "roblox-ts",
			kind: "inline",
		});
	});

	it("summarizes complex defaults and preserves their exact JSON", () => {
		expect.assertions(1);

		// Given
		const documentation = getRuleOptionsDocumentation("memoized-effect-dependencies");

		// When
		const hooks = documentation.options.find((option) => option.name === "hooks");

		// Then
		expect(hooks?.defaultValue).toStrictEqual({
			copyValue:
				'[{"dependenciesIndex":1,"name":"useEffect"},{"dependenciesIndex":1,"name":"useInsertionEffect"},{"dependenciesIndex":1,"name":"useLayoutEffect"}]',
			displayValue: `[
	{
		"dependenciesIndex": 1,
		"name": "useEffect"
	},
	{
		"dependenciesIndex": 1,
		"name": "useInsertionEffect"
	},
	{
		"dependenciesIndex": 1,
		"name": "useLayoutEffect"
	}
]`,
			kind: "complex",
			summary: "3 hooks",
		});
	});
});
