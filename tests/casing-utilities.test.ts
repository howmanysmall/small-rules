import { describe, expect, it } from "vitest";
import { toPascalCase } from "$oxc-utilities/casing-utilities";

describe("toPascalCase", () => {
	it("should return an empty string for blank input", () => {
		expect.assertions(1);

		expect(toPascalCase(" ".repeat(3))).toBe("");
	});

	it("should split camel and acronym boundaries", () => {
		expect.assertions(1);

		expect(toPascalCase("httpRequestURLParser")).toBe("HttpRequestUrlParser");
	});

	it("should ignore empty internal separators", () => {
		expect.assertions(1);

		// oxlint-disable-next-line unicorn/prefer-code-point -- slop rule
		const separator = String.fromCharCode(0);
		const value = `${separator}already${separator}${separator}Split${separator}`;

		expect(toPascalCase(value)).toBe("AlreadySplit");
	});

	it("should return an empty string when separators contain no words", () => {
		expect.assertions(1);

		// oxlint-disable-next-line unicorn/prefer-code-point -- slop rule
		expect(toPascalCase(String.fromCharCode(0).repeat(2))).toBe("");
	});

	it("should separate words that start with digits", () => {
		expect.assertions(1);

		// oxlint-disable-next-line unicorn/prefer-code-point -- slop rule
		const separator = String.fromCharCode(0);
		const value = `phase${separator}2${separator}complete`;
		expect(toPascalCase(value)).toBe("Phase_2Complete");
	});
});
