import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import smallRules from "$small-rules";

import { ruleExamples } from "../documentation/src/data/rule-examples";
import {
	formatRuleTitle,
	getRuleCategoryPath,
	getRulePath,
	ruleManifest,
} from "../documentation/src/data/rule-manifest";
import { ruleRelations } from "../documentation/src/data/rule-relations";

const docsContentDirectory = fileURLToPath(new URL("../documentation/src/content/docs", import.meta.url));
const rulePagesDirectory = join(docsContentDirectory, "rules");

interface RuleExampleCoverage {
	readonly exemption: string | undefined;
	readonly invalidCount: number;
	readonly name: string;
	readonly validCount: number;
}

function getManifestRuleNames(): ReadonlyArray<string> {
	return ruleManifest.categories.flatMap((category) => category.rules.map((entry) => entry.name));
}

function getExpectedRulePagePaths(): ReadonlyArray<string> {
	return ruleManifest.categories.flatMap((category) =>
		category.rules.map((entry) => join(docsContentDirectory, `${getRulePath(category, entry.name)}.mdx`)),
	);
}

function getRulePagePaths(): ReadonlyArray<string> {
	return readdirSync(rulePagesDirectory, { encoding: "utf8", recursive: true })
		.filter((relativePath) => relativePath.endsWith(".mdx") && basename(relativePath) !== "index.mdx")
		.map((relativePath) => join(rulePagesDirectory, relativePath));
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

function getRuleExampleCoverage(): ReadonlyArray<RuleExampleCoverage> {
	return ruleManifest.categories.flatMap((category) =>
		category.rules.map((entry): RuleExampleCoverage => {
			const examples = ruleExamples.get(entry.name) ?? [];
			return {
				exemption: "exampleExemption" in entry ? entry.exampleExemption : undefined,
				invalidCount: examples.filter((example) => example.kind === "invalid").length,
				name: entry.name,
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
			return !(hasExamples || hasReasonedExemption);
		})
		.map(({ name }) => name);
}

function getExampleCountViolationNames(): ReadonlyArray<string> {
	return getRuleExampleCoverage()
		.filter(({ exemption }) => exemption === undefined)
		.filter(({ invalidCount, validCount }) => invalidCount !== 1 || validCount !== 1)
		.map(({ name }) => name);
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

	it("keeps curated rationale only for the two complex rules", () => {
		expect.assertions(1);
		const expectedPaths = [
			join(rulePagesDirectory, "general/no-restricted-property-assignment.mdx"),
			join(rulePagesDirectory, "roblox/no-async-in-system.mdx"),
		].toSorted();

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
});
// Phase 4 extension points: category landing pages and the all-rules landing page.
