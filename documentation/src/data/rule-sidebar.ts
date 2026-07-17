import { getRulePath, ruleManifest } from "./rule-manifest";

import type { StarlightUserConfig } from "@astrojs/starlight/types";

export const ruleSidebarGroups = ruleManifest.categories.map((category) => ({
	collapsed: false,
	items: category.rules.map((entry) => getRulePath(category, entry.name)),
	label: category.label,
})) satisfies NonNullable<StarlightUserConfig["sidebar"]>;
