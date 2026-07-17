import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ruleExamples } from "../documentation/src/data/rule-examples";
import { extractRuleExamples } from "../documentation/src/utilities/extract-rule-examples";

import type { RuleExample } from "../documentation/src/utilities/extract-rule-examples";

const fixtureDirectory = fileURLToPath(new URL("fixtures/documentation-rule-extractor", import.meta.url));

function extractFixture(fixtureName: string): ReturnType<typeof extractRuleExamples> {
	const relativePath = `tests/fixtures/documentation-rule-extractor/${fixtureName}`;
	const sourceText = readFileSync(join(fixtureDirectory, fixtureName), "utf8");
	return extractRuleExamples(sourceText, relativePath);
}

function getFixtureExamples(fixtureName: string): ReadonlyArray<RuleExample> | undefined {
	const [extraction] = extractFixture(fixtureName);
	return extraction?.examples;
}

describe("extractRuleExamples", () => {
	it("loads every top-level rule test into the Astro build-time map", () => {
		expect.assertions(1);

		expect(ruleExamples.size).toBeGreaterThan(0);
	});

	it("extracts every supported static expression and orders examples by kind then ID", () => {
		expect.assertions(1);

		expect(getFixtureExamples("static-values.fixture.ts")).toStrictEqual([
			{
				code: "const\nvalue = 1;",
				errors: [{ messageId: "joined" }, { message: "A second diagnostic" }],
				id: "joined",
				kind: "invalid",
				output: "const\nvalue = 2;",
				title: "Joined source",
			},
			{
				code: "const value = 1;",
				errors: [{ messageId: "literal" }],
				id: "literal",
				kind: "invalid",
				title: "String literal",
			},
			{
				code: "const raw = `value`;",
				errors: [
					{
						messageId: "raw",
						suggestions: [{ messageId: "replaceRaw", output: "const raw = 'value';" }],
					},
				],
				id: "raw",
				kind: "invalid",
				title: "Raw template",
			},
			{
				code: "const valid = true;",
				filename: "example.ts",
				id: "template",
				kind: "valid",
				language: "ts",
				options: [{ enabled: true, limit: 2, nothing: null, values: ["first", "second"] }],
				settings: { feature: { enabled: true } },
				sourceType: "script",
				title: "Template literal",
			},
		]);
	});

	it("ignores unmarked cases even when they contain unsupported expressions", () => {
		expect.assertions(1);

		expect(getFixtureExamples("unmarked-unsupported.fixture.ts")).toStrictEqual([
			{
				code: "const valid = true;",
				id: "pass",
				kind: "valid",
				title: "Static case",
			},
		]);
	});

	it("rejects duplicate example IDs within a rule", () => {
		expect.assertions(1);

		expect(() => extractFixture("duplicate-id.fixture.ts")).toThrow(
			'tests/fixtures/documentation-rule-extractor/duplicate-id.fixture.ts:16:25: duplicate documentation example ID "same".',
		);
	});

	it("rejects interpolated template literals in marked cases", () => {
		expect.assertions(1);

		expect(() => extractFixture("interpolated-template.fixture.ts")).toThrow(
			"tests/fixtures/documentation-rule-extractor/interpolated-template.fixture.ts:9:10: interpolated template literals are not supported.",
		);
	});

	it("rejects identifier references in marked cases", () => {
		expect.assertions(1);

		expect(() => extractFixture("identifier-reference.fixture.ts")).toThrow(
			"tests/fixtures/documentation-rule-extractor/identifier-reference.fixture.ts:9:10: identifier references are not supported.",
		);
	});

	it("rejects spreads in marked cases", () => {
		expect.assertions(1);

		expect(() => extractFixture("spread.fixture.ts")).toThrow(
			"tests/fixtures/documentation-rule-extractor/spread.fixture.ts:11:4: spread properties are not supported.",
		);
	});

	it("rejects function calls other than supported join calls", () => {
		expect.assertions(1);

		expect(() => extractFixture("call.fixture.ts")).toThrow(
			"tests/fixtures/documentation-rule-extractor/call.fixture.ts:9:10: function calls are not supported.",
		);
	});

	it("rejects computed keys in marked cases", () => {
		expect.assertions(1);

		expect(() => extractFixture("computed-key.fixture.ts")).toThrow(
			"tests/fixtures/documentation-rule-extractor/computed-key.fixture.ts:11:4: computed object keys are not supported.",
		);
	});

	it("rejects documentation markers without static id and title strings", () => {
		expect.assertions(1);

		expect(() => extractFixture("invalid-marker.fixture.ts")).toThrow(
			"tests/fixtures/documentation-rule-extractor/invalid-marker.fixture.ts:10:25: documentation.id must evaluate to a string.",
		);
	});

	it("rejects marked focused cases", () => {
		expect.assertions(1);

		expect(() => extractFixture("only.fixture.ts")).toThrow(
			"tests/fixtures/documentation-rule-extractor/only.fixture.ts:11:4: documented cases cannot use only.",
		);
	});

	it("rejects marked skipped cases", () => {
		expect.assertions(1);

		expect(() => extractFixture("skip.fixture.ts")).toThrow(
			"tests/fixtures/documentation-rule-extractor/skip.fixture.ts:11:4: documented cases cannot use skip.",
		);
	});
});
