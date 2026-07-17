import { defineRule } from "oxlint-plugin-utilities";

import {
	getOptionalStringArrayProperty,
	parseDirectiveComment,
	toForceLocation,
} from "../utilities/directive-comments";

import type { Visitor } from "oxlint-plugin-utilities";

const directiveNoUse = defineRule({
	create(context): Visitor {
		const allowed = new Set(getOptionalStringArrayProperty(context.options[0], "allow"));

		for (const comment of context.sourceCode.getAllComments()) {
			const directive = parseDirectiveComment(comment);
			if (directive === undefined || comment.type === "Line" || allowed.has(directive.kind)) continue;

			context.report({
				loc: toForceLocation(directive.comment.loc),
				messageId: "disallow",
			});
		}

		return {};
	},
	meta: {
		docs: {
			description: "Disallow block ESLint/Oxlint directive comments.",
		},
		messages: {
			disallow: "Unexpected ESLint directive comment.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allow: {
						description: "Directive kinds that are still allowed in block comments.",
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

export default directiveNoUse;
