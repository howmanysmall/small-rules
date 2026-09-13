import { createRule } from "$oxc-utilities/create-rule";
import {
	getOptionalStringArrayProperty,
	isDisableOrEnableDirectiveKind,
	parseDirectiveComment,
} from "$oxc-utilities/directive-comments";

import type { Comment, Visitor } from "oxlint-plugin-utilities";

const DESCRIPTION_SEPARATOR = /\s-{2,}\s/u;
const OXLINT_LINE_DIRECTIVE = /^(?<kind>oxlint-disable|oxlint-enable)(?:\s|$)/u;

const directiveRequireDescription = createRule("directive-require-description", "general", {
	create(context): Visitor {
		const ignoreKinds: ReadonlySet<string> = new Set(getOptionalStringArrayProperty(context.options[0], "ignore"));

		function isSkippedKind(kind: string): boolean {
			return !isDisableOrEnableDirectiveKind(kind) || ignoreKinds.has(kind);
		}

		function hasInlineDescription(text: string): boolean {
			return DESCRIPTION_SEPARATOR.test(text);
		}

		function getOxlintLineKind(text: string): string | undefined {
			const match = OXLINT_LINE_DIRECTIVE.exec(text);
			const kind = match?.groups?.kind;
			/* v8 ignore next -- OXLINT_LINE_DIRECTIVE only matches disable/enable directive kinds. @preserve */
			if (kind === undefined || !isDisableOrEnableDirectiveKind(kind)) return undefined;
			return kind;
		}

		function reportMissingDescription(kind: string, location: Comment["loc"]): void {
			context.report({
				data: { kind },
				loc: location,
				messageId: "missingDescription",
			});
		}

		function isMissingParsedDescription(kind: string, description: string | undefined): boolean {
			return !isSkippedKind(kind) && description === undefined;
		}

		function handleParsedDirective(comment: Comment): boolean {
			const directive = parseDirectiveComment(comment);
			if (directive === undefined) return false;
			if (!isMissingParsedDescription(directive.kind, directive.description)) return true;
			reportMissingDescription(directive.kind, directive.comment.loc);
			return true;
		}

		function isReportableLineText(kind: string, text: string): boolean {
			return !ignoreKinds.has(kind) && !hasInlineDescription(text);
		}

		function handleLineDirective(comment: Comment): void {
			// parseDirectiveComment rejects line comments with block-style
			// directives
			// (eslint-disable, oxlint-disable, etc.) because ESLint requires block
			// comments for those. But oxlint supports // oxlint-disable and
			// // oxlint-enable in line comments, so check those directly.
			if (comment.type !== "Line") return;

			const text = comment.value.trim();
			const kind = getOxlintLineKind(text);
			if (kind === undefined || !isReportableLineText(kind, text)) return;

			reportMissingDescription(kind, comment.loc);
		}

		function checkComment(comment: Comment): void {
			if (handleParsedDirective(comment)) return;
			handleLineDirective(comment);
		}

		for (const comment of context.sourceCode.getAllComments()) checkComment(comment);

		return {};
	},
	meta: {
		docs: {
			description: "Require descriptions for `oxlint` and `eslint` disable/enable directives.",
		},
		messages: {
			missingDescription: "Missing description for '{{kind}}' comment.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					ignore: {
						description: "Directive kinds that do not require a description.",
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
