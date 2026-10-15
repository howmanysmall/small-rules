import { describe, expect, it } from "vitest";

import { isStringArray, isStringRecord } from "$oxc-utilities/type-utilities";

describe("isStringArray", () => {
	it("should reject arrays containing non-string items", () => {
		expect.assertions(1);

		const value = ["valid", 1];

		expect(isStringArray(value)).toBe(false);
	});
});

describe("isStringRecord", () => {
	it("should reject records containing non-string values", () => {
		expect.assertions(1);

		const value = { name: "valid", count: 1 };

		expect(isStringRecord(value)).toBe(false);
	});
});
