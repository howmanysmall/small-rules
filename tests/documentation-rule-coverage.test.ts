import { existsSync, readdirSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { walk } from "yuku-ast";
import { parse } from "yuku-parser";

import smallRules from "$small-rules";

import { ruleExamples } from "../documentation/src/data/rule-examples";
import { getRulePath, ruleManifest } from "../documentation/src/data/rule-manifest";
import { ruleRelations } from "../documentation/src/data/rule-relations";

import type { Node, Program } from "yuku-parser";

import type { RuleExample } from "../documentation/src/utilities/extract-rule-examples";

const docsContentDirectory = fileURLToPath(new URL("../documentation/src/content/docs", import.meta.url));
const rulePagesDirectory = nodePath.join(docsContentDirectory, "rules");

interface RuleExampleCoverage {
	readonly name: string;
	readonly exemption: string | undefined;
	readonly invalidCount: number;
	readonly validCount: number;
}

function getManifestRuleNames(): ReadonlyArray<string> {
	return ruleManifest.categories.flatMap((category) => category.rules.map((entry) => entry.name));
}

function getRulePageSources(): ReadonlyArray<{ readonly path: string; readonly source: string }> {
	const relativePaths = readdirSync(rulePagesDirectory, { encoding: "utf8", recursive: true });
	const pages = new Array<{ readonly path: string; readonly source: string }>();

	for (const relativePath of relativePaths) {
		if (!relativePath.endsWith(".mdx") || nodePath.basename(relativePath) === "index.mdx") continue;
		const path = nodePath.join(rulePagesDirectory, relativePath);
		pages.push({ path, source: readFileSync(path, "utf8") });
	}

	return pages;
}

function getExpectedRulePagePaths(): ReadonlySet<string> {
	return new Set(
		ruleManifest.categories.flatMap((category) =>
			category.rules.map((entry) =>
				nodePath.join(docsContentDirectory, `${getRulePath(category, entry.name)}.mdx`),
			),
		),
	);
}

function getExpectedRuleIndexPagePaths(): ReadonlyArray<string> {
	return [
		nodePath.join(rulePagesDirectory, "index.mdx"),
		...ruleManifest.categories.map((category) => nodePath.join(rulePagesDirectory, category.key, "index.mdx")),
	];
}

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

function getExampleCoverageViolations(): ReadonlyArray<string> {
	return getRuleExampleCoverage()
		.filter(({ exemption, invalidCount, validCount }) => {
			if (exemption !== undefined) return exemption.trim() === "";
			return invalidCount !== 1 || validCount !== 1;
		})
		.map(({ name }) => name);
}

type ExampleParseLanguage = "dts" | "js" | "jsx" | "ts" | "tsx";

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

describe("documentation rule coverage", () => {
	it("derives every documented rule from the plugin", () => {
		expect.assertions(1);

		expect(getManifestRuleNames().toSorted()).toStrictEqual(Object.keys(smallRules.rules).toSorted());
	});

	it("keeps one authored MDX page per manifest rule", () => {
		expect.assertions(2);
		const missingPages = [...getExpectedRulePagePaths()].filter((path) => !existsSync(path));
		const pagesWithoutRulePage = getRulePageSources()
			.filter(({ source }) => !source.includes("<RulePage rule="))
			.map(({ path }) => path);

		expect(missingPages).toStrictEqual([]);
		expect(pagesWithoutRulePage).toStrictEqual([]);
	});

	it("does not contain orphan rule pages", () => {
		expect.assertions(1);
		const expectedRulePagePaths = getExpectedRulePagePaths();
		const orphanPages = getRulePageSources()
			.map(({ path }) => path)
			.filter((path) => !expectedRulePagePaths.has(path));

		expect(orphanPages).toStrictEqual([]);
	});

	it("keeps relation endpoints in the plugin", () => {
		expect.assertions(1);
		const pluginRuleNames = new Set(Object.keys(smallRules.rules));
		const unknownEndpoints = ruleRelations
			.flatMap((relation) => [relation.from, relation.to])
			.filter((name) => !pluginRuleNames.has(name));

		expect(unknownEndpoints).toStrictEqual([]);
	});

	it("extracts one fail and one pass example for each non-exempt rule", () => {
		expect.assertions(1);

		expect(getExampleCoverageViolations()).toStrictEqual([]);
	});

	it("keeps multi-statement documented examples on multiple lines", () => {
		expect.assertions(1);

		expect(getCrampedDocumentedExampleLabels()).toStrictEqual([]);
	});

	it("provides an all-rules page and one landing page per category", () => {
		expect.assertions(1);
		const missingIndexPages = getExpectedRuleIndexPagePaths().filter((path) => !existsSync(path));

		expect(missingIndexPages).toStrictEqual([]);
	});
});
