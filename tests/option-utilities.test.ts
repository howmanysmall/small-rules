import { describe, expect, it } from "vitest";
import { isAllowAutofixOption } from "$oxc-utilities/option-utilities";

describe("option utilities", () => {
	it("accepts object options without allowAutofix", () => {
		expect.assertions(1);

		expect(isAllowAutofixOption({ environment: "roblox-ts" })).toBe(true);
	});

	it("accepts boolean or undefined allowAutofix values", () => {
		expect.assertions(3);

		expect(isAllowAutofixOption({ allowAutofix: true })).toBe(true);
		expect(isAllowAutofixOption({ allowAutofix: false })).toBe(true);
		expect(isAllowAutofixOption({ allowAutofix: undefined })).toBe(true);
	});

	it("rejects non-object values and non-boolean allowAutofix values", () => {
		expect.assertions(4);

		expect(isAllowAutofixOption(null)).toBe(false);
		expect(isAllowAutofixOption("allow")).toBe(false);
		expect(isAllowAutofixOption(true)).toBe(false);
		expect(isAllowAutofixOption({ allowAutofix: "yes" })).toBe(false);
	});
});
