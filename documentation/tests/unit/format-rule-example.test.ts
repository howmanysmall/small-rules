import { describe, it } from "vitest";

import { formatExampleSnippetAsync, formatRuleExampleAsync } from "$utilities/format-rule-example";

import type { RuleExample } from "$utilities/extract-rule-examples";

function createExample(overrides: Partial<RuleExample>): RuleExample {
	return {
		id: "sample",
		code: "const value = 1;",
		kind: "valid",
		title: "Sample",
		...overrides,
	};
}

describe("formatExampleSnippetAsync", () => {
	it("expands single-line classes, enums, interfaces, and blocks across multiple lines", async ({ expect }) => {
		expect.assertions(4);

		const constructorClass = await formatExampleSnippetAsync(
			"class Foo { constructor() { this.foo = 123; } }",
			"js",
		);
		const propertyClass = await formatExampleSnippetAsync('class Foo { foo = "bar"; }', "js");
		const enumDeclaration = await formatExampleSnippetAsync(
			"enum SORTORDER {MostRecent, LeastRecent, Newest, Oldest}",
			"ts",
		);
		const interfaceDeclaration = await formatExampleSnippetAsync("interface UserShape { id: string }", "tsx");

		expect(constructorClass).toBe(
			["class Foo {", "  constructor() {", "    this.foo = 123;", "  }", "}"].join("\n"),
		);
		expect(propertyClass).toBe(["class Foo {", '  foo = "bar";', "}"].join("\n"));
		expect(enumDeclaration).toBe(
			["enum SORTORDER {", "  MostRecent,", "  LeastRecent,", "  Newest,", "  Oldest,", "}"].join("\n"),
		);
		expect(interfaceDeclaration).toBe(["interface UserShape {", "  id: string;", "}"].join("\n"));
	});

	it("handles jsx, dts, and undefined languages and strips leading/trailing blank lines", async ({ expect }) => {
		expect.assertions(3);

		const jsxResult = await formatExampleSnippetAsync("\n\nfunction Component() { return <frame />; }\n\n", "jsx");
		const dtsResult = await formatExampleSnippetAsync("declare function read(path: string): string;", "dts");
		const defaultResult = await formatExampleSnippetAsync("function f() { return 1; }");

		expect(jsxResult).toBe(["function Component() {", "  return <frame />;", "}"].join("\n"));
		expect(dtsResult).toBe("declare function read(path: string): string;");
		expect(defaultResult).toBe(["function f() {", "  return 1;", "}"].join("\n"));
	});

	it("throws an explicit error when formatting fails on invalid syntax", async ({ expect }) => {
		expect.assertions(1);

		await expect(formatExampleSnippetAsync("const = ;", "ts")).rejects.toThrow(
			/^Failed to format example snippet:/u,
		);
	});
});

describe("formatRuleExampleAsync", () => {
	it("formats both code and non-empty string output using language rather than extensionless filename", async ({
		expect,
	}) => {
		expect.assertions(2);

		const example = createExample({
			code: "function f() { return 1; }",
			filename: "source",
			kind: "invalid",
			language: "jsx",
			output: "function f() { return 2; }",
		});

		const formatted = await formatRuleExampleAsync(example);

		expect(formatted.code).toBe(["function f() {", "  return 1;", "}"].join("\n"));
		expect(formatted.output).toBe(["function f() {", "  return 2;", "}"].join("\n"));
	});

	it("preserves empty string and missing output fields", async ({ expect }) => {
		expect.assertions(2);

		const emptyOutput = await formatRuleExampleAsync(createExample({ kind: "invalid", output: "" }));
		const missingOutput = await formatRuleExampleAsync(createExample({ kind: "valid" }));

		expect(emptyOutput.output).toBe("");
		expect("output" in missingOutput).toBe(false);
	});

	it("preserves internal formatting when preserveFormatting is true and trims only blank edge lines", async ({
		expect,
	}) => {
		expect.assertions(3);

		const codeWithBlankEdges = ["", "\tfor (const item of items)", "\t\tvisit(item);", ""].join("\n");
		const outputWithBlankEdges = ["", "for (const item of items) {", "\tvisit(item);", "}", ""].join("\n");

		const preservedWithOutput = await formatRuleExampleAsync(
			createExample({
				code: codeWithBlankEdges,
				kind: "invalid",
				output: outputWithBlankEdges,
				preserveFormatting: true,
			}),
		);
		const preservedWithoutOutput = await formatRuleExampleAsync(
			createExample({
				code: codeWithBlankEdges,
				preserveFormatting: true,
			}),
		);

		expect(preservedWithOutput.code).toBe(["\tfor (const item of items)", "\t\tvisit(item);"].join("\n"));
		expect(preservedWithOutput.output).toBe(["for (const item of items) {", "\tvisit(item);", "}"].join("\n"));
		expect("output" in preservedWithoutOutput).toBe(false);
	});
});
