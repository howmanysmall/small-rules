import { describe, it } from "vitest";

import { toOxlintParityCases } from "./oxlint-parity";

describe("toOxlintParityCases", () => {
	it("leaves out cases that carry a harnessOnly reason and counts them", ({ expect }) => {
		expect.assertions(1);

		const converted = toOxlintParityCases({
			invalid: [
				{ code: "second();", errors: 1, harnessOnly: "Does not parse under Oxlint." },
				{ code: "third();", errors: 1 },
			],
			valid: ["first();", { code: "fourth();", harnessOnly: "Oxlint rejects these options." }],
		});

		expect(converted).toStrictEqual({
			harnessOnlyCount: 2,
			tests: { invalid: [{ code: "third();", errors: 1 }], valid: ["first();"] },
		});
	});

	it("leaves out skipped cases without counting them as harness-only", ({ expect }) => {
		expect.assertions(1);

		const converted = toOxlintParityCases({ invalid: [], valid: [{ code: "first();", skip: true }] });

		expect(converted).toStrictEqual({ harnessOnlyCount: 0, tests: { invalid: [], valid: [] } });
	});

	it("carries the filename, options, settings, language, and source type across", ({ expect }) => {
		expect.assertions(1);

		const { tests } = toOxlintParityCases({
			invalid: [],
			valid: [
				{
					filename: "source/first.ts",
					code: "first();",
					options: [{ allow: ["first"] }],
					language: "ts",
					settings: { environment: "standard" },
					sourceType: "script",
				},
			],
		});

		expect(tests.valid).toStrictEqual([
			{
				code: "first();",
				filename: "source/first.ts",
				languageOptions: { parserOptions: { lang: "ts" }, sourceType: "script" },
				options: [{ allow: ["first"] }],
				settings: { environment: "standard" },
			},
		]);
	});

	it("carries declared globals across", ({ expect }) => {
		expect.assertions(1);

		const { tests } = toOxlintParityCases({
			invalid: [],
			valid: [{ code: "console.log(first);", globals: { console: "readonly" } }],
		});

		expect(tests.valid).toStrictEqual([
			{ code: "console.log(first);", languageOptions: { globals: { console: "readonly" } } },
		]);
	});

	it("drops the documentation entry, which only the docs site reads", ({ expect }) => {
		expect.assertions(1);

		const { tests } = toOxlintParityCases({
			invalid: [],
			valid: [{ code: "first();", documentation: { id: "pass", title: "A passing case" } }],
		});

		expect(tests.valid).toStrictEqual([{ code: "first();" }]);
	});

	it("keeps positions, message data, and suggestions that state their output", ({ expect }) => {
		expect.assertions(1);

		const { tests } = toOxlintParityCases({
			invalid: [
				{
					code: "first();",
					output: null,
					errors: [
						{
							column: 1,
							data: { name: "first" },
							endColumn: 8,
							endLine: 1,
							line: 1,
							messageId: "banned",
							suggestions: [{ messageId: "remove", output: "" }],
						},
					],
				},
			],
			valid: [],
		});

		expect(tests.invalid).toStrictEqual([
			{
				code: "first();",
				errors: [
					{
						column: 1,
						data: { name: "first" },
						endColumn: 8,
						endLine: 1,
						line: 1,
						messageId: "banned",
						suggestions: [{ messageId: "remove", output: "" }],
					},
				],
				output: null,
			},
		]);
	});

	it("falls back to the error count when an expected error names no message", ({ expect }) => {
		expect.assertions(1);

		const { tests } = toOxlintParityCases({
			invalid: [{ code: "first();", errors: [{ messageId: "banned" }, { line: 1 }] }],
			valid: [],
		});

		expect(tests.invalid).toStrictEqual([{ code: "first();", errors: 2 }]);
	});

	it("leaves suggestions unchecked when one of them states no output", ({ expect }) => {
		expect.assertions(1);

		const { tests } = toOxlintParityCases({
			invalid: [
				{
					code: "first();",
					errors: [{ messageId: "banned", suggestions: [{ messageId: "remove" }] }, { message: "Second." }],
				},
			],
			valid: [],
		});

		expect(tests.invalid).toStrictEqual([
			{ code: "first();", errors: [{ messageId: "banned" }, { message: "Second." }] },
		]);
	});

	it("leaves message data unchecked when a value is not a primitive", ({ expect }) => {
		expect.assertions(1);

		const { tests } = toOxlintParityCases({
			invalid: [{ code: "first();", errors: [{ data: { names: ["first"] }, messageId: "banned" }] }],
			valid: [],
		});

		expect(tests.invalid).toStrictEqual([{ code: "first();", errors: [{ messageId: "banned" }] }]);
	});
});
