import { createRule } from "$oxc-utilities/create-rule";
import { getDirectiveComments, isDisableDirectiveKind, toForceLocation } from "$oxc-utilities/directive-comments";
import { MESSAGE_ID_SUGGESTION } from "$oxc-utilities/prevent-abbreviations/constants";

import type { Visitor } from "oxlint-plugin-utilities";

const directiveNoUnlimitedDisable = createRule("directive-no-unlimited-disable", "general", {
	create(context): Visitor {
		for (const directive of getDirectiveComments(context.sourceCode, isDisableDirectiveKind)) {
			if (directive.value === undefined || directive.value.length === 0) {
				context.report({
					data: { kind: directive.kind },
					loc: toForceLocation(directive.comment.loc),
					messageId: "unexpected",
				});
			}
		}

		return {};
	},
	meta: {
		docs: {
			description: "Disallow `oxlint-disable` or `eslint-disable` comments without rule names.",
		},
		messages: {
			unexpected: "Unexpected unlimited '{{kind}}' comment. Specify some rule names to disable.",
		},
		schema: [],
		type: MESSAGE_ID_SUGGESTION,
	},
});

export default directiveNoUnlimitedDisable;
