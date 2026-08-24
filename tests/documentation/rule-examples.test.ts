import { describe, expect, it } from "vitest";
import { walk } from "yuku-ast";
import { parse } from "yuku-parser";

import { ruleExamples } from "../../documentation/src/data/rule-examples";
import { ruleManifest } from "../../documentation/src/data/rule-manifest";

import type { Node, Program } from "yuku-parser";

import type { RuleExample } from "../../documentation/src/utilities/extract-rule-examples";

interface RuleExampleCoverage {
	readonly name: string;
	readonly exemption: string | undefined;
	readonly invalidCount: number;
	readonly validCount: number;
}

function isMissingRequiredExamples({ exemption, invalidCount, validCount }: RuleExampleCoverage): boolean {
	return exemption === undefined && (invalidCount !== 1 || validCount !== 1);
}

type ExampleParseLanguage = "dts" | "js" | "jsx" | "ts" | "tsx";

function getRuleExampleCoverage(): ReadonlyArray<RuleExampleCoverage> {
	return ruleManifest.categories.flatMap((category) =>
		category.rules.map((entry): RuleExampleCoverage => {
			const examples = ruleExamples.get(entry.name) ?? [];
			return {
				name: entry.name,
				exemption: "exampleExemption" in entry ? entry.exampleExemption : undefined,
				invalidCount: examples.filter((example) => example.kind === "invalid").length,
				validCount: examples.filter((example) => example.kind === "valid").length,
			};
		}),
	);
}

function resolveExampleLanguage({ language }: RuleExample): ExampleParseLanguage {
	switch (language) {
		case "dts":
		case "js":
		case "jsx":
		case "ts":
		case "tsx":
			return language;
		default:
			return "ts";
	}
}

function parseExampleProgram(code: string, language: ExampleParseLanguage): Program | undefined {
	const primary = parse(code, { lang: language, sourceType: "module" });
	if (primary.diagnostics.length === 0) return primary.program;
	if (language === "tsx") return undefined;

	const fallback = parse(code, { lang: "tsx", sourceType: "module" });
	return fallback.diagnostics.length === 0 ? fallback.program : undefined;
}

function isMultiStatementContainer(node: Node): boolean {
	switch (node.type) {
		case "BlockStatement":
		case "Program":
			return node.body.length >= 2;

		case "ClassBody":
			return node.body.length >= 2;

		case "SwitchCase":
			return node.consequent.length >= 2;

		default:
			return false;
	}
}

function isCrampedDocumentedExample(code: string, language: ExampleParseLanguage): boolean {
	if (code.includes("\n") || code.trim() === "") return false;

	const program = parseExampleProgram(code, language);
	if (program === undefined || isMultiStatementContainer(program)) return program !== undefined;

	let cramped = false;
	walk(program, {
		enter(node) {
			if (isMultiStatementContainer(node)) cramped = true;
		},
	});
	return cramped;
}

const collator = new Intl.Collator();

function getCrampedDocumentedExampleLabels(): ReadonlyArray<string> {
	const labels = new Array<string>();
	for (const [ruleName, examples] of ruleExamples) {
		for (const example of examples) {
			if (isCrampedDocumentedExample(example.code, resolveExampleLanguage(example))) {
				labels.push(`${ruleName}/${example.kind}/${example.id}`);
			}
		}
	}
	return labels.toSorted((left, right) => collator.compare(left, right));
}

describe("documented rule examples", () => {
	it("extracts one fail and one pass example for each non-exempt rule", () => {
		expect.assertions(1);
		const violations = getRuleExampleCoverage()
			.filter(isMissingRequiredExamples)
			.map(({ name }) => name);

		expect(violations).toStrictEqual([]);
	});

	it("rejects blank example exemptions", () => {
		expect.assertions(1);
		const blankExemptions = getRuleExampleCoverage()
			.filter(({ exemption }) => exemption?.trim() === "")
			.map(({ name }) => name);

		expect(blankExemptions).toStrictEqual([]);
	});

	it("keeps multi-statement documented examples on multiple lines", () => {
		expect.assertions(1);

		expect(getCrampedDocumentedExampleLabels()).toStrictEqual([]);
	});
});
