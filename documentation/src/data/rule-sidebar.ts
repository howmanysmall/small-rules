import { getRuleCategoryPath, getRulePath, ruleManifest } from "./rule-manifest";
import { getRuleNewness } from "./rule-newness";

import type { StarlightUserConfig } from "@astrojs/starlight/types";

const newness = getRuleNewness();

export const ruleSidebarGroups = ruleManifest.categories.map((category) => ({
	collapsed: false,
	items: [
		{ label: "Overview", slug: getRuleCategoryPath(category) },
		...category.rules.map((entry) => {
			const freshness = newness.get(entry.name);
			if (freshness?.isNew === true) {
				return {
					badge: { text: "New", variant: "note" } as const,
					slug: getRulePath(category, entry.name),
				};
			}
			if (freshness?.isUpdated === true) {
				return {
					badge: { text: "Updated", variant: "tip" } as const,
					slug: getRulePath(category, entry.name),
				};
			}
			return getRulePath(category, entry.name);
		}),
	],
	label: category.label,
})) satisfies NonNullable<StarlightUserConfig["sidebar"]>;
