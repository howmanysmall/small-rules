import { defineRule } from "oxlint-plugin-utilities";

import { computeDisabledArea, toRuleIdLocation } from "../utilities/directive-comments";

import type { Visitor } from "oxlint-plugin-utilities";

const directiveNoUnusedEnable = defineRule({
	create(context): Visitor {
		const disabledArea = computeDisabledArea(context.sourceCode);

		for (const item of disabledArea.unusedEnableDirectives) {
			context.report({
				data: {
					kind: "eslint-enable",
					ruleId: item.ruleId ?? "",
				},
				loc: toRuleIdLocation(item.comment, item.ruleId),
				messageId: item.ruleId === undefined ? "unused" : "unusedRule",
			});
		}

		return {};
	},
	meta: {
		docs: {
			description: "Disallow unused `oxlint-enable` or `eslint-enable` comments.",
		},
		messages: {
			unused: "Unused '{{kind}}' comment. No reported rules are disabled.",
			unusedRule:
				"'{{ruleId}}' rule is disabled but never reported. Please remove unnecessary '{{kind}}' comment.",
		},
		schema: [],
		type: "suggestion" as const,
	},
});

export default directiveNoUnusedEnable;
