import { getRuleCategoryPath, getRulePath, ruleManifest } from "./rule-manifest";
import { getRuleNewness } from "./rule-newness";

import type { StarlightUserConfig } from "@astrojs/starlight/types";

import type { RuleCategoryManifest, RuleManifestEntry } from "./rule-manifest";
import type { RuleNewness } from "./rule-newness";

const newness = getRuleNewness();

interface SidebarBadge {
	readonly text: "New" | "Updated";
	readonly variant: "note" | "tip";
}

interface SidebarBadgeItem {
	readonly badge: SidebarBadge;
	readonly slug: string;
}

function getNewBadge(freshness: RuleNewness | undefined): SidebarBadge | undefined {
	return freshness?.isNew === true ? { text: "New", variant: "note" } : undefined;
}

function getUpdatedBadge(freshness: RuleNewness | undefined): SidebarBadge | undefined {
	return freshness?.isUpdated === true ? { text: "Updated", variant: "tip" } : undefined;
}

function createRuleSidebarItem(category: RuleCategoryManifest, entry: RuleManifestEntry): SidebarBadgeItem | string {
	const slug = getRulePath(category, entry.name);
	const freshness = newness.get(entry.name);
	const badge = getNewBadge(freshness) ?? getUpdatedBadge(freshness);
	return badge === undefined ? slug : { badge, slug };
}

export const ruleSidebarGroups = ruleManifest.categories.map((category) => ({
	collapsed: false,
	items: [
		{ label: "Overview", slug: getRuleCategoryPath(category) },
		...category.rules.map((entry) => createRuleSidebarItem(category, entry)),
	],
	label: category.label,
})) satisfies NonNullable<StarlightUserConfig["sidebar"]>;
