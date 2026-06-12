import { defineRule } from "oxlint-plugin-utilities";

import { computeDisabledArea, toRuleIdLocation } from "../utilities/directive-comments";

import type { Visitor } from "oxlint-plugin-utilities";

const directiveNoDuplicateDisable = defineRule({
	create(context): Visitor {
		const disabledArea = computeDisabledArea(context.sourceCode);

		for (const item of disabledArea.duplicateDisableDirectives) {
			context.report({
				data: { ruleId: item.ruleId ?? "" },
				loc: toRuleIdLocation(item.comment, item.ruleId),
				messageId: item.ruleId === undefined ? "duplicate" : "duplicateRule",
			});
		}
		return {};
	},
	meta: {
		docs: {
			description: "disallow duplicate `eslint-disable` comments",
		},
		messages: {
			duplicate: "ESLint rules have been disabled already.",
			duplicateRule: "'{{ruleId}}' rule has been disabled already.",
		},
		schema: [],
		type: "problem" as const,
	},
});

export default directiveNoDuplicateDisable;
