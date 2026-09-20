import { describe, expect, it } from "vitest";

import { toTsConfigSource } from "$utilities/oxlint-config";

describe("toTsConfigSource", () => {
	it("converts a plugin registration block to a defineConfig module", () => {
		expect.assertions(1);
		expect(toTsConfigSource(["{", '\t"jsPlugins": ["@pobammer-ts/small-rules"]', "}"].join("\n"))).toBe(
			[
				'import { defineConfig } from "oxlint";',
				"",
				"export default defineConfig({",
				'\tjsPlugins: ["@pobammer-ts/small-rules"],',
				"});",
			].join("\n"),
		);
	});

	it("keeps quotes on keys that are not valid identifiers", () => {
		expect.assertions(1);
		expect(
			toTsConfigSource(
				[
					"{",
					'\t"rules": {',
					'\t\t"small-rules/no-print": "error",',
					'\t\t"small-rules/prefer-early-return": "warn"',
					"\t}",
					"}",
				].join("\n"),
			),
		).toBe(
			[
				'import { defineConfig } from "oxlint";',
				"",
				"export default defineConfig({",
				"\trules: {",
				'\t\t"small-rules/no-print": "error",',
				'\t\t"small-rules/prefer-early-return": "warn",',
				"\t},",
				"});",
			].join("\n"),
		);
	});

	it("expands arrays containing objects while keeping short primitive arrays inline", () => {
		expect.assertions(1);
		expect(
			toTsConfigSource(
				[
					"{",
					'\t"rules": {',
					'\t\t"small-rules/ban-instances": [',
					'\t\t\t"error",',
					"\t\t\t{",
					'\t\t\t\t"ban": ["ScreenGui", "Frame"]',
					"\t\t\t}",
					"\t\t]",
					"\t}",
					"}",
				].join("\n"),
			),
		).toBe(
			[
				'import { defineConfig } from "oxlint";',
				"",
				"export default defineConfig({",
				"\trules: {",
				'\t\t"small-rules/ban-instances": [',
				'\t\t\t"error",',
				"\t\t\t{",
				'\t\t\t\tban: ["ScreenGui", "Frame"],',
				"\t\t\t},",
				"\t\t],",
				"\t},",
				"});",
			].join("\n"),
		);
	});

	it("expands primitive arrays that exceed the inline width limit", () => {
		expect.assertions(1);
		expect(
			toTsConfigSource(
				[
					"{",
					'\t"rules": {',
					'\t\t"small-rules/example": [',
					'\t\t\t"error",',
					"\t\t\t{",
					'\t\t\t\t"iterationMethods": ["map", "filter", "forEach", "flatMap", "reduce", "reduceRight", "some", "every", "find", "findIndex"]',
					"\t\t\t}",
					"\t\t]",
					"\t}",
					"}",
				].join("\n"),
			),
		).toBe(
			[
				'import { defineConfig } from "oxlint";',
				"",
				"export default defineConfig({",
				"\trules: {",
				'\t\t"small-rules/example": [',
				'\t\t\t"error",',
				"\t\t\t{",
				"\t\t\t\titerationMethods: [",
				'\t\t\t\t\t"map",',
				'\t\t\t\t\t"filter",',
				'\t\t\t\t\t"forEach",',
				'\t\t\t\t\t"flatMap",',
				'\t\t\t\t\t"reduce",',
				'\t\t\t\t\t"reduceRight",',
				'\t\t\t\t\t"some",',
				'\t\t\t\t\t"every",',
				'\t\t\t\t\t"find",',
				'\t\t\t\t\t"findIndex",',
				"\t\t\t\t],",
				"\t\t\t},",
				"\t\t],",
				"\t},",
				"});",
			].join("\n"),
		);
	});

	it("renders numbers, booleans, and null primitives", () => {
		expect.assertions(1);
		expect(
			toTsConfigSource(
				[
					"{",
					'\t"rules": {',
					'\t\t"small-rules/example": [',
					'\t\t\t"error",',
					"\t\t\t{",
					'\t\t\t\t"maxLines": 200,',
					'\t\t\t\t"allowConditionalClosers": false,',
					'\t\t\t\t"tag": null',
					"\t\t\t}",
					"\t\t]",
					"\t}",
					"}",
				].join("\n"),
			),
		).toBe(
			[
				'import { defineConfig } from "oxlint";',
				"",
				"export default defineConfig({",
				"\trules: {",
				'\t\t"small-rules/example": [',
				'\t\t\t"error",',
				"\t\t\t{",
				"\t\t\t\tmaxLines: 200,",
				"\t\t\t\tallowConditionalClosers: false,",
				"\t\t\t\ttag: null,",
				"\t\t\t},",
				"\t\t],",
				"\t},",
				"});",
			].join("\n"),
		);
	});

	it("renders empty objects and arrays compactly", () => {
		expect.assertions(1);
		expect(toTsConfigSource('{"settings": {}, "overrides": []}')).toBe(
			[
				'import { defineConfig } from "oxlint";',
				"",
				"export default defineConfig({",
				"\tsettings: {},",
				"\toverrides: [],",
				"});",
			].join("\n"),
		);
	});

	it("throws on invalid JSON", () => {
		expect.assertions(1);
		expect(() => toTsConfigSource("{oops")).toThrow(SyntaxError);
	});
});
