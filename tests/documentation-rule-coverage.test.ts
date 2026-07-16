import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import smallRules from "$small-rules";

import {
	formatRuleTitle,
	getRuleCategoryPath,
	getRulePath,
	ruleManifest,
} from "../documentation/src/data/rule-manifest";
import { ruleRelations } from "../documentation/src/data/rule-relations";

const docsContentDirectory = fileURLToPath(new URL("../documentation/src/content/docs", import.meta.url));
const rulePagesDirectory = join(docsContentDirectory, "rules");

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

	it("keeps relation endpoints in the manifest", () => {
		expect.assertions(1);
		const manifestRuleNames = new Set(getManifestRuleNames());
		const relationEndpoints = ruleRelations.flatMap((relation) => [relation.from, relation.to]);

		expect(relationEndpoints.every((name) => manifestRuleNames.has(name))).toBe(true);
	});
});

// Phase 2 extension points: extracted examples and explicit example exemptions.
// Phase 4 extension points: category landing pages and the all-rules landing page.
