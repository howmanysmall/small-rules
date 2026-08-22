import { existsSync, readdirSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import smallRules from "$small-rules";
import { walk } from "yuku-ast";
import { parse } from "yuku-parser";

import { ruleExamples } from "../documentation/src/data/rule-examples";
import {
	formatRuleTitle,
	getRuleCategoryPath,
	getRulePath,
	ruleManifest,
} from "../documentation/src/data/rule-manifest";
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

function getExpectedRulePagePaths(): ReadonlyArray<string> {
	return ruleManifest.categories.flatMap((category) =>
		category.rules.map((entry) => nodePath.join(docsContentDirectory, `${getRulePath(category, entry.name)}.mdx`)),
	);
}

function getRulePagePaths(): ReadonlyArray<string> {
	const relativePaths = readdirSync(rulePagesDirectory, { encoding: "utf8", recursive: true });
	const rulePagePaths = new Array<string>();
	let size = 0;

	for (const relativePath of relativePaths) {
		if (!relativePath.endsWith(".mdx") || nodePath.basename(relativePath) === "index.mdx") continue;
		rulePagePaths[size++] = nodePath.join(rulePagesDirectory, relativePath);
	}

	return rulePagePaths;
}

function getRulePageSources(): ReadonlyArray<{ readonly path: string; readonly source: string }> {
	return getRulePagePaths().map((path) => ({ path, source: readFileSync(path, "utf8") }));
}

function getNonThinRulePagePaths(): ReadonlyArray<string> {
	return getRulePageSources()
		.filter(({ source }) => !source.includes('import RulePage from "@/components/rule-page.astro";'))
		.map(({ path }) => path);
}

function getCuratedRationaleRulePagePaths(): ReadonlyArray<string> {
	return getRulePageSources()
		.filter(({ source }) => source.includes('slot="rationale"'))
		.map(({ path }) => path)
		.toSorted();
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

function getUncoveredRuleNames(): ReadonlyArray<string> {
	return getRuleExampleCoverage()
		.filter(({ exemption, invalidCount, validCount }) => {
			const hasExamples = invalidCount > 0 && validCount > 0;
			const hasReasonedExemption = exemption !== undefined && exemption.trim() !== "";
			return !hasExamples && !hasReasonedExemption;
		})
		.map(({ name }) => name);
}

function getExampleCountViolationNames(): ReadonlyArray<string> {
	return getRuleExampleCoverage()
		.filter(({ exemption }) => exemption === undefined)
		.filter(({ invalidCount, validCount }) => invalidCount !== 1 || validCount !== 1)
		.map(({ name }) => name);
}

type ExampleParseLanguage = "dts" | "js" | "jsx" | "ts" | "tsx";

function resolveExampleLanguage({ language }: RuleExample): ExampleParseLanguage {
	if (language === "dts" || language === "js" || language === "jsx" || language === "ts" || language === "tsx") {
		return language;
	}
	return "ts";
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
	if (program === undefined) return false;

	let cramped = isMultiStatementContainer(program);
	if (cramped) return true;

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
			if (!isCrampedDocumentedExample(example.code, resolveExampleLanguage(example))) continue;
			labels.push(`${ruleName}/${example.kind}/${example.id}`);
		}
	}
	return labels.toSorted((left, right) => collator.compare(left, right));
}

describe("documentation rule coverage", () => {
	it("matches the plugin rule set", () => {
		expect.assertions(1);
		const manifestRuleNames = getManifestRuleNames().toSorted();
		const pluginRuleNames = Object.keys(smallRules.rules).toSorted();

		expect(manifestRuleNames).toStrictEqual(pluginRuleNames);
	});

	it("does not duplicate manifest rules", () => {
		expect.assertions(1);
		const manifestRuleNames = getManifestRuleNames();

		expect(new Set(manifestRuleNames).size).toBe(manifestRuleNames.length);
	});

	it("does not duplicate manifest categories", () => {
		expect.assertions(1);
		const categoryKeys = ruleManifest.categories.map((category) => category.key);

		expect(new Set(categoryKeys).size).toBe(categoryKeys.length);
	});

	it("generates canonical category and rule paths", () => {
		expect.assertions(2);
		const [reactCategory] = ruleManifest.categories;

		expect(getRuleCategoryPath(reactCategory)).toBe("rules/react");
		expect(getRulePath(reactCategory, "ban-react-fc")).toBe("rules/react/ban-react-fc");
	});

	it("formats kebab-case rule titles", () => {
		expect.assertions(2);

		expect(formatRuleTitle("no-print")).toBe("No Print");
		expect(formatRuleTitle("prefer-udim2-shorthand")).toBe("Prefer Udim2 Shorthand");
	});

	it("maps every manifest rule to one existing MDX page", () => {
		expect.assertions(2);
		const expectedRulePagePaths = getExpectedRulePagePaths();

		expect(new Set(expectedRulePagePaths).size).toBe(expectedRulePagePaths.length);
		expect(expectedRulePagePaths.filter((path) => existsSync(path))).toHaveLength(expectedRulePagePaths.length);
	});

	it("maps every discovered rule page to the manifest", () => {
		expect.assertions(1);
		const expectedRulePagePaths = new Set(getExpectedRulePagePaths());
		const discoveredRulePagePaths = getRulePagePaths();

		expect(discoveredRulePagePaths.every((path) => expectedRulePagePaths.has(path))).toBe(true);
	});

	it("does not contain orphan rule pages", () => {
		expect.assertions(1);
		const expectedRulePagePaths = new Set(getExpectedRulePagePaths());
		const orphanRulePagePaths = getRulePagePaths().filter((path) => !expectedRulePagePaths.has(path));

		expect(orphanRulePagePaths).toStrictEqual([]);
	});

	it("uses the shared rule page component for every rule", () => {
		expect.assertions(1);

		expect(getNonThinRulePagePaths()).toStrictEqual([]);
	});

	it("keeps curated rationale pages explicit", () => {
		expect.assertions(1);
		const expectedPaths = [
			"anti-slop/no-chained-type-assertions",
			"anti-slop/no-conditional-empty-object-spread",
			"anti-slop/no-known-value-widening",
			"anti-slop/no-module-mocking",
			"anti-slop/no-object-parameters",
			"anti-slop/no-reflect-apply",
			"anti-slop/no-reflect-get",
			"anti-slop/no-runtime-typeof",
			"anti-slop/no-shape-in-symbol-names",
			"anti-slop/no-unknown-parameters",
			"anti-slop/no-unknown-returns",
			"anti-slop/no-unknown-type-aliases",
			"anti-slop/no-unsafe-dictionary-type",
			"anti-slop/no-widen-then-assert",
			"anti-slop/require-safety-comment-for-type-assertion",
			"general/no-increment-decrement",
			"general/no-recursive",
			"general/no-restricted-property-assignment",
			"react/no-adjust-state-on-prop-change",
			"react/no-chain-state-updates",
			"react/no-derived-state",
			"react/no-event-handler",
			"react/no-external-store-subscription",
			"react/no-initialize-state",
			"react/no-pass-data-to-parent",
			"react/no-pass-live-state-to-parent",
			"react/no-reset-all-state-on-prop-change",
			"roblox/ban-instances",
			"roblox/no-array-constructor-elements",
			"roblox/no-array-constructor-index-assignment",
			"roblox/no-array-size-assignment",
			"roblox/no-async-in-system",
			"roblox/no-color3-constructor",
			"roblox/no-events-in-events-callback",
			"roblox/no-instance-methods-without-this",
			"roblox/no-native-properties-spread",
			"roblox/no-print",
			"roblox/no-redundant-aspect-ratio-constraint",
			"roblox/no-table-create-map",
			"roblox/no-task-wait",
			"roblox/no-useless-default",
			"roblox/no-warn",
			"roblox/prefer-idiv",
			"roblox/prefer-math-min-max",
			"roblox/prefer-modding-inspect",
			"roblox/prefer-sequence-overloads",
			"roblox/prefer-single-world-query",
			"roblox/prefer-udim2-shorthand",
			"roblox/require-module-level-instantiation",
		]
			.map((path) => nodePath.join(rulePagesDirectory, `${path}.mdx`))
			.toSorted((left, right) => collator.compare(left, right));

		expect(getCuratedRationaleRulePagePaths()).toStrictEqual(expectedPaths);
	});

	it("keeps relation endpoints in the manifest", () => {
		expect.assertions(1);
		const manifestRuleNames = new Set(getManifestRuleNames());
		const relationEndpoints = ruleRelations.flatMap((relation) => [relation.from, relation.to]);

		expect(relationEndpoints.every((name) => manifestRuleNames.has(name))).toBe(true);
	});

	it("provides a fail and pass example or a reasoned exemption for every rule", () => {
		expect.assertions(1);

		expect(getUncoveredRuleNames()).toStrictEqual([]);
	});

	it("extracts exactly one fail and one pass example for each non-exempt rule", () => {
		expect.assertions(1);

		expect(getExampleCountViolationNames()).toStrictEqual([]);
	});

	it("keeps multi-statement documented examples on multiple lines", () => {
		expect.assertions(1);

		expect(getCrampedDocumentedExampleLabels()).toStrictEqual([]);
	});

	it("provides an all-rules page and one landing page per category", () => {
		expect.assertions(2);
		const expectedRuleIndexPagePaths = getExpectedRuleIndexPagePaths();

		expect(expectedRuleIndexPagePaths).toHaveLength(6);
		expect(expectedRuleIndexPagePaths.filter((path) => !existsSync(path))).toStrictEqual([]);
	});
});
