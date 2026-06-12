import { describe, expect, it } from "vitest";
import { toPascalCase } from "$oxc-utilities/casing-utilities";

describe("toPascalCase", () => {
	it("should return an empty string for blank input", () => {
		expect.assertions(1);

		// Arrange
		const value = "   ";

		// Act
		const result = toPascalCase(value);

		// Assert
		expect(result).toBe("");
	});

	it("should split camel and acronym boundaries", () => {
		expect.assertions(1);

		// Arrange
		const value = "httpRequestURLParser";

		// Act
		const result = toPascalCase(value);

		// Assert
		expect(result).toBe("HttpRequestUrlParser");
	});

	it("should ignore empty internal separators", () => {
		expect.assertions(1);

		// Arrange
		const separator = String.fromCodePoint(0);
		const value = `${separator}already${separator}${separator}Split${separator}`;

		// Act
		const result = toPascalCase(value);

		// Assert
		expect(result).toBe("AlreadySplit");
	});

	it("should separate words that start with digits", () => {
		expect.assertions(1);

		// Arrange
		const separator = String.fromCodePoint(0);
		const value = `phase${separator}2${separator}complete`;

		// Act
		const result = toPascalCase(value);

		// Assert
		expect(result).toBe("Phase_2Complete");
	});
});
