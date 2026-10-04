import { getRulePath, ruleManifest } from "./rule-manifest";

import type { RuleManifest } from "./rule-manifest";

/** The path the documentation site is served under. */
export const SITE_BASE = "/small-rules";

/** Old rule paths mapped to the rule pages that replaced them. */
export type RuleRedirects = Readonly<Record<string, string>>;

/**
 * Builds redirects from each rule's previous categories to its current page.
 *
 * Astro adds the site base to redirect sources but not to destinations, so
 * the base is added to destinations here.
 *
 * @param manifest - The rule manifest to read `movedFrom` entries from.
 * @param base - The path the site is served under.
 * @returns A map of old rule paths to current rule pages.
 */
export function createRuleRedirects(manifest: RuleManifest, base: string): RuleRedirects {
	return Object.fromEntries(
		manifest.categories.flatMap((category) =>
			category.rules.flatMap(({ name, movedFrom = [] }) => {
				const destination = `${base}/${getRulePath(category, name)}/`;
				return movedFrom.map((previousKey) => [`/rules/${previousKey}/${name}`, destination]);
			}),
		),
	);
}

export const ruleRedirects = createRuleRedirects(ruleManifest, SITE_BASE);
