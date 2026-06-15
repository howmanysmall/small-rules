import { defineRule } from "oxlint-plugin-utilities";

import {
	getOptionalStringArrayProperty,
	isDisableOrEnableDirectiveKind,
	parseDirectiveComment,
} from "../utilities/directive-comments";

import type { Comment, Visitor } from "oxlint-plugin-utilities";

const DESCRIPTION_SEPARATOR = /\s-{2,}\s/u;
const OXLINT_LINE_DIRECTIVE = /^(?<kind>oxlint-disable|oxlint-enable)(?:\s|$)/u;

const directiveRequireDescription = defineRule({
	create(context): Visitor {
		const ignoreKinds: ReadonlySet<string> = new Set(getOptionalStringArrayProperty(context.options[0], "ignore"));

		function checkComment(comment: Comment): void {
			const directive = parseDirectiveComment(comment);

			if (directive !== undefined) {
				const { kind } = directive;
				if (!isDisableOrEnableDirectiveKind(kind)) return;
				if (ignoreKinds.has(kind)) return;
				if (directive.description !== undefined) return;

				context.report({
					data: { kind: directive.kind },
					loc: directive.comment.loc,
					messageId: "missingDescription",
				});
				return;
			}

			// parseDirectiveComment rejects line comments with block-style directives
			// (eslint-disable, oxlint-disable, etc.) because ESLint requires block
			// comments for those. But oxlint supports // oxlint-disable and
			// // oxlint-enable in line comments, so check those directly.
			if (comment.type !== "Line") return;

			const text = comment.value.trim();
			const match = OXLINT_LINE_DIRECTIVE.exec(text);
			if (match === null) return;

			const kind = match.groups?.kind;
			if (kind === undefined) return;
			if (!isDisableOrEnableDirectiveKind(kind)) return;
			if (ignoreKinds.has(kind)) return;
			if (DESCRIPTION_SEPARATOR.test(text)) return;

			context.report({
				data: { kind },
				loc: comment.loc,
				messageId: "missingDescription",
			});
		}

		for (const comment of context.sourceCode.getAllComments()) {
			checkComment(comment);
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
