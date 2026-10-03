import { findRuleFactsByPath, getRuleFacts } from "$data/rule-facts";
import { getRelatedRules } from "$data/rule-relations";

import type { StarlightRouteData } from "@astrojs/starlight/route-data";

import type { RuleName } from "$data/rule-manifest";

type TableOfContentsItem = NonNullable<StarlightRouteData["toc"]>["items"][number];

export interface RulePageSection {
	readonly slug: string;
	readonly text: string;
}

interface RulePageSectionOptions {
	readonly hasRationale: boolean;
}

const rationaleSection: RulePageSection = { slug: "rationale", text: "Rationale" };
const diagnosticsSection: RulePageSection = { slug: "diagnostic-messages", text: "Diagnostic Messages" };
const configurationSection: RulePageSection = { slug: "configuration", text: "Configuration" };
const examplesSection: RulePageSection = { slug: "examples", text: "Examples" };
const relatedRulesSection: RulePageSection = { slug: "related-rules", text: "Related Rules" };

/**
 * The sections `rule-page.astro` renders for a rule, in page order. The rule
 * page and its table of contents both read this, so they cannot disagree.
 *
 * @param rule - The rule the page documents.
 * @param options - Whether the page passes a rationale slot.
 * @returns The rendered sections, in order.
 */
export function getRulePageSections(rule: RuleName, options: RulePageSectionOptions): ReadonlyArray<RulePageSection> {
	const sections = new Array<RulePageSection>();
	if (options.hasRationale) sections.push(rationaleSection);
	if (Object.keys(getRuleFacts(rule).messages ?? {}).length > 0) sections.push(diagnosticsSection);

	sections.push(configurationSection, examplesSection);
	if (getRelatedRules(rule).length > 0) sections.push(relatedRulesSection);
	return sections;
}

export function findRuleNameByPath(path: string): RuleName | undefined {
	return findRuleFactsByPath(path)?.name;
}

/**
 * Adds rule page sections to a Starlight table of contents as top-level
 * entries after the overview, skipping any the page already lists.
 *
 * @param items - The table of contents Starlight built from the page's Markdown.
 * @param sections - The rule page sections to add.
 * @returns A new list of table of contents items.
 */
export function appendRulePageSections(
	items: ReadonlyArray<TableOfContentsItem>,
	sections: ReadonlyArray<RulePageSection>,
): Array<TableOfContentsItem> {
	const listed = new Set(items.map((item) => item.slug));
	const merged = [...items];
	for (const section of sections) {
		if (listed.has(section.slug)) continue;
		merged.push({ children: [], depth: 2, slug: section.slug, text: section.text });
	}
	return merged;
}
