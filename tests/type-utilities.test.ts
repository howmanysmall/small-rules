import { describe, expect, it } from "vitest";
import { isStringArray, isStringRecord } from "$oxc-utilities/type-utilities";

describe("isStringArray", () => {
	it("should reject arrays containing non-string items", () => {
		expect.assertions(1);

		// Arrange
		const value = ["valid", 1];

		// Act
		const result = isStringArray(value);

		// Assert
		expect(result).toBe(false);
	});
});

describe("isStringRecord", () => {
	it("should reject records containing non-string values", () => {
		expect.assertions(1);

		// Arrange
		const value = { count: 1, name: "valid" };

		// Act
		const result = isStringRecord(value);

		// Assert
		expect(result).toBe(false);
	});
});
