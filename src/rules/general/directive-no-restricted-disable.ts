import ignore from "ignore";

import { createRule } from "$oxc-utilities/create-rule";
import { computeDisabledArea, toRuleIdLocation } from "$oxc-utilities/directive-comments";

import type { Visitor } from "oxlint-plugin-utilities";

const directiveNoRestrictedDisable = createRule("directive-no-restricted-disable", "general", {
	create(context): Visitor {
		const disabledArea = computeDisabledArea(context.sourceCode);
		const restrictedRules = context.options;
		if (restrictedRules.length === 0) return {};

		const restrictedRuleMatcher = ignore();
		for (const restrictedRule of restrictedRules) {
			restrictedRuleMatcher.add(restrictedRule);
		}

		for (const area of disabledArea.areas) {
			if (area.ruleId === undefined || restrictedRuleMatcher.ignores(area.ruleId)) {
				context.report({
					data: { ruleId: area.ruleId ?? String(restrictedRules) },
					loc: toRuleIdLocation(area.comment, area.ruleId),
					messageId: "disallow",
				});
			}
		}

		return {};
	},
	meta: {
		docs: {
			description: "Disallow `oxlint-disable` or `eslint-disable` comments for configured rules.",
		},
		messages: {
			disallow: "Disabling '{{ruleId}}' is not allowed.",
		},
		schema: {
			items: { type: "string" as const },
			type: "array" as const,
			uniqueItems: true,
		},
		type: "suggestion" as const,
	},
});

export default directiveNoRestrictedDisable;
