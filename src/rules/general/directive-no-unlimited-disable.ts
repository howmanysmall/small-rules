import { createRule } from "$oxc-utilities/create-rule";
import { isDisableDirectiveKind, parseDirectiveComment, toForceLocation } from "$oxc-utilities/directive-comments";

import type { Visitor } from "oxlint-plugin-utilities";

const directiveNoUnlimitedDisable = createRule("directive-no-unlimited-disable", "general", {
	create(context): Visitor {
		for (const comment of context.sourceCode.getAllComments()) {
			const directive = parseDirectiveComment(comment);
			if (directive === undefined) continue;

			const { kind } = directive;
			if (!isDisableDirectiveKind(kind)) {
				continue;
			}
			if (directive.value === undefined || directive.value === "") {
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
		type: "suggestion" as const,
	},
});

export default directiveNoUnlimitedDisable;
