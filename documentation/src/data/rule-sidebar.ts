import { getRuleCategoryPath, getRulePath, ruleManifest } from "./rule-manifest";
import { getRuleNewness } from "./rule-newness";

import type { StarlightUserConfig } from "@astrojs/starlight/types";

const newness = getRuleNewness();

export const ruleSidebarGroups = ruleManifest.categories.map((category) => ({
	collapsed: false,
	items: [
		{ label: "Overview", slug: getRuleCategoryPath(category) },
		...category.rules.map((entry) =>
			newness.get(entry.name)?.isNew === true
				? { badge: { text: "New", variant: "note" } as const, slug: getRulePath(category, entry.name) }
				: getRulePath(category, entry.name),
		),
	],
	label: category.label,
})) satisfies NonNullable<StarlightUserConfig["sidebar"]>;
