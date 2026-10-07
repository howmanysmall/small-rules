import { createRule } from "$oxc-utilities/create-rule";
import { computeDisabledArea, toForceLocation } from "$oxc-utilities/directive-comments";
import { MESSAGE_ID_SUGGESTION } from "$oxc-utilities/prevent-abbreviations/constants";

import type { Visitor } from "oxlint-plugin-utilities";

const directiveNoAggregatingEnable = createRule("directive-no-aggregating-enable", "general", {
	create(context): Visitor {
		const disabledArea = computeDisabledArea(context.sourceCode);

		for (const [comment, count] of disabledArea.numberOfRelatedDisableDirectives) {
			if (count > 1) {
				context.report({
					data: { kind: "eslint-enable" },
					loc: toForceLocation(comment.loc),
					messageId: "aggregatingEnable",
				});
			}
		}

		return {};
	},
	meta: {
		docs: {
			description:
				"Disallow aggregating `oxlint-enable` or `eslint-enable` comments across multiple disable directives.",
		},
		messages: {
			aggregatingEnable:
				"'{{kind}}' comment enables rules for multiple disable directives. Please move '{{kind}}' after each disable directive.",
		},
		schema: [],
		type: MESSAGE_ID_SUGGESTION,
	},
});

export default directiveNoAggregatingEnable;
