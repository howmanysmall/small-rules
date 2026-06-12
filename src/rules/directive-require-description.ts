import { defineRule } from "oxlint-plugin-utilities";

import {
	getOptionalStringArrayProperty,
	isDisableOrEnableDirectiveKind,
	parseDirectiveComment,
} from "../utilities/directive-comments";

import type { Visitor } from "oxlint-plugin-utilities";

const directiveRequireDescription = defineRule({
	create(context): Visitor {
		const ignoreKinds: ReadonlySet<string> = new Set(getOptionalStringArrayProperty(context.options[0], "ignore"));

		for (const comment of context.sourceCode.getAllComments()) {
			const directive = parseDirectiveComment(comment);
			if (directive === undefined) continue;

			const { kind } = directive;
			if (!isDisableOrEnableDirectiveKind(kind)) {
				continue;
			}

			if (ignoreKinds.has(kind)) continue;

			if (directive.description === undefined) {
				context.report({
					data: { kind: directive.kind },
					loc: directive.comment.loc,
					messageId: "missingDescription",
				});
			}
		}

		return {};
	},
	meta: {
		docs: {
			description: "require description for `eslint-disable` and `eslint-enable` directives",
		},
		messages: {
			missingDescription: "Missing description for '{{kind}}' comment.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					ignore: {
						items: { type: "string" as const },
						type: "array" as const,
						uniqueItems: true,
					},
				},
				type: "object" as const,
			},
		],
		type: "suggestion" as const,
	},
});

export default directiveRequireDescription;
