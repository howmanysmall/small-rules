import { defineRouteMiddleware } from "@astrojs/starlight/route-data";

import { appendRulePageSections, findRuleNameByPath, getRulePageSections } from "$data/rule-page-sections";

const RATIONALE_SLOT = /slot=["']rationale["']/u;

/**
 * Rule pages render their sections from components, so Starlight only sees
 * the overview. This adds the rendered sections to the table of contents.
 */
export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	const rule = findRuleNameByPath(route.entry.id);
	if (rule === undefined || route.toc === undefined) return;

	const hasRationale = RATIONALE_SLOT.test(route.entry.body ?? "");
	route.toc.items = appendRulePageSections(route.toc.items, getRulePageSections(rule, { hasRationale }));
});
