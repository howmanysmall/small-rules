import { existsSync, readdirSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getRulePath, ruleManifest } from "../../documentation/src/data/rule-manifest";

const docsContentDirectory = fileURLToPath(new URL("../../documentation/src/content/docs", import.meta.url));
const rulePagesDirectory = nodePath.join(docsContentDirectory, "rules");
const RULE_PAGE_PROPS = /<RulePage\s+rule="([^"]+)"/gu;

interface RulePageSource {
	readonly name: string | undefined;
	readonly path: string;
	readonly propCount: number;
}

function getExpectedRulePagePaths(): ReadonlyMap<string, string> {
	const paths = new Map<string, string>();
	for (const category of ruleManifest.categories) {
		for (const entry of category.rules) {
			paths.set(nodePath.join(docsContentDirectory, `${getRulePath(category, entry.name)}.mdx`), entry.name);
		}
	}
	return paths;
}

function getRulePageSources(): ReadonlyArray<RulePageSource> {
	const relativePaths = readdirSync(rulePagesDirectory, { encoding: "utf8", recursive: true });
	const pages = new Array<RulePageSource>();

	for (const relativePath of relativePaths) {
		if (!relativePath.endsWith(".mdx") || nodePath.basename(relativePath) === "index.mdx") continue;
		const path = nodePath.join(rulePagesDirectory, relativePath);
		const source = readFileSync(path, "utf8");
		const props = [...source.matchAll(RULE_PAGE_PROPS)];
		pages.push({ name: props[0]?.[1], path, propCount: props.length });
	}

	return pages;
}

describe("rule page routes", () => {
	it("keeps one authored MDX page per manifest rule", () => {
		expect.assertions(1);

		expect([...getExpectedRulePagePaths().keys()].filter((path) => !existsSync(path))).toStrictEqual([]);
	});

	it("does not contain orphan rule pages", () => {
		expect.assertions(1);
		const expectedRulePagePaths = getExpectedRulePagePaths();

		expect(
			getRulePageSources()
				.map(({ path }) => path)
				.filter((path) => !expectedRulePagePaths.has(path)),
		).toStrictEqual([]);
	});

	it("binds exactly one RulePage wrapper per page to the route's rule", () => {
		expect.assertions(2);
		const expectedRulePagePaths = getExpectedRulePagePaths();
		const mismatches = getRulePageSources().filter(({ name, path, propCount }) => {
			if (propCount !== 1) return true;
			return expectedRulePagePaths.get(path) !== name;
		});

		expect(mismatches.filter(({ propCount }) => propCount !== 1).map(({ path }) => path)).toStrictEqual([]);
		expect(
			mismatches
				.filter(({ propCount }) => propCount === 1)
				.map(({ name, path }) => `${nodePath.relative(docsContentDirectory, path)}: ${name ?? ""}`),
		).toStrictEqual([]);
	});

	it("provides an all-rules page and one landing page per category", () => {
		expect.assertions(1);
		const indexPaths = [
			nodePath.join(rulePagesDirectory, "index.mdx"),
			...ruleManifest.categories.map((category) => nodePath.join(rulePagesDirectory, category.key, "index.mdx")),
		];

		expect(indexPaths.filter((path) => !existsSync(path))).toStrictEqual([]);
	});
});
