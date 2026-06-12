import { defineRule } from "oxlint-plugin-utilities";

import { parseDirectiveComment, toForceLocation } from "../utilities/directive-comments";

import type { Visitor } from "oxlint-plugin-utilities";

const directiveNoUnlimitedDisable = defineRule({
	create(context): Visitor {
		for (const comment of context.sourceCode.getAllComments()) {
			const directive = parseDirectiveComment(comment);
			if (directive === undefined) continue;

			const { kind } = directive;
			if (
				kind !== "eslint-disable" &&
				kind !== "eslint-disable-line" &&
				kind !== "eslint-disable-next-line" &&
				kind !== "oxlint-disable" &&
				kind !== "oxlint-disable-line" &&
				kind !== "oxlint-disable-next-line"
			) {
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
			description: "disallow `eslint-disable` comments without rule names",
		},
		messages: {
			unexpected: "Unexpected unlimited '{{kind}}' comment. Specify some rule names to disable.",
		},
		schema: [],
		type: "suggestion" as const,
	},
});

export default directiveNoUnlimitedDisable;
