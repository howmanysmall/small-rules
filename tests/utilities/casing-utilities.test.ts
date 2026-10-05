import { describe, expect, it } from "vitest";
import { fc } from "@fast-check/vitest";

import { toPascalCase } from "$oxc-utilities/casing-utilities";
import { PROPERTY_RUNS } from "$test/property-runs";

// Lowercase words of two or more letters: a one-letter word next to another
// capital reads as part of an acronym, which camelCase cannot express.
const camelCaseWordsArbitrary = fc.array(fc.stringMatching(/^[a-z]{2,}$/u), { minLength: 1 });

const alphanumericNameArbitrary = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]*$/u);

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

	it("should join a one-letter word with the next one when they would read as an acronym", () => {
		// Catches output that toPascalCase itself would rewrite, so it never
		// counts as PascalCase. Shrunk from the idempotence property.
		expect.assertions(2);

		expect(toPascalCase("aA")).toBe("Aa");
		expect(toPascalCase("Aa")).toBe("Aa");
	});

	it("should separate words that start with digits", () => {
		expect.assertions(1);

		// oxlint-disable-next-line unicorn/prefer-code-point -- slop rule
		const separator = String.fromCharCode(0);
		const value = `phase${separator}2${separator}complete`;

		expect(toPascalCase(value)).toBe("Phase_2Complete");
	});
});

describe("toPascalCase properties", () => {
	it("should capitalize each word of a camelCase name", () => {
		// Catches a word boundary being missed or invented inside camelCase.
		expect.hasAssertions();

		const report = fc.defaultReportMessage(
			fc.check(
				fc.property(camelCaseWordsArbitrary, (words) => {
					// Arrange
					const camelCase = toCamelCase(words);

					// Act
					const pascalCase = toPascalCase(camelCase);

					// Assert
					expect(pascalCase).toBe(words.map(capitalize).join(""));
				}),
				{ numRuns: PROPERTY_RUNS },
			),
		);

		// Assert
		expect(report).toBeUndefined();
	});

	it("should only change letter case for alphanumeric names", () => {
		// Catches characters being dropped, duplicated, or reordered.
		expect.hasAssertions();

		const report = fc.defaultReportMessage(
			fc.check(
				fc.property(alphanumericNameArbitrary, (name) => {
					// Act
					const pascalCase = toPascalCase(name);

					// Assert
					expect(pascalCase.toLowerCase()).toBe(name.toLowerCase());
				}),
				{ numRuns: PROPERTY_RUNS },
			),
		);

		// Assert
		expect(report).toBeUndefined();
	});

	it("should leave its own output unchanged", () => {
		// Catches output that toPascalCase would rewrite again, which the
		// `part === toPascalCase(part)` PascalCase check would then reject.
		expect.hasAssertions();

		const report = fc.defaultReportMessage(
			fc.check(
				fc.property(alphanumericNameArbitrary, (name) => {
					// Arrange
					const once = toPascalCase(name);

					// Act
					const twice = toPascalCase(once);

					// Assert
					expect(twice).toBe(once);
				}),
				{ numRuns: PROPERTY_RUNS },
			),
		);

		// Assert
		expect(report).toBeUndefined();
	});
});

// Helpers

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1);
}

function toCamelCase([head = "", ...tail]: ReadonlyArray<string>): string {
	return head + tail.map(capitalize).join("");
}
