import { isStringLiteral } from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";
import { isAllowAutofixOption } from "$oxc-utilities/option-utilities";
import { getReceiverText } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const STRICT_OPERATORS = new Set(["!==", "==="]);
const LOOSE_OPERATORS = new Set(["!=", "=="]);

function isEmptyStringLiteral(node: ESTree.Node): boolean {
	return isStringLiteral(node) && node.value.length === 0;
}

const noUselessEmptyStringComparison = createRule("no-useless-empty-string-comparison", "general", {
	createOnce(context): Visitor {
		return {
			BinaryExpression(node): void {
				const isStrict = STRICT_OPERATORS.has(node.operator);
				if (!isStrict && !LOOSE_OPERATORS.has(node.operator)) return;

				const leftIsEmpty = isEmptyStringLiteral(node.left);
				if (!leftIsEmpty && !isEmptyStringLiteral(node.right)) return;

				if (!isStrict) {
					context.report({ messageId: "looseEmptyStringComparison", node });
					return;
				}

				const receiver = getReceiverText(context.sourceCode, leftIsEmpty ? node.right : node.left);
				const replacement = `${receiver}.length ${node.operator} 0`;
				const [options] = context.options;
				if (isAllowAutofixOption(options) && options.allowAutofix) {
					context.report({
						data: { replacement },
						fix(fixer) {
							return fixer.replaceText(node, replacement);
						},
						messageId: "useLengthComparison",
						node,
					});
					return;
				}

				context.report({
					data: { replacement },
					messageId: "useLengthComparison",
					node,
					suggest: [
						{
							data: { replacement },
							fix(fixer) {
								return fixer.replaceText(node, replacement);
							},
							messageId: "suggestLengthComparison",
						},
					],
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow equality comparisons against an empty-string literal.",
			recommended: true,
		},
		fixable: "code",
		hasSuggestions: true,
		messages: {
			looseEmptyStringComparison:
				"Comparing to '' with a loose operator also matches 0 and false. Use `===` and then `.length === 0`.",
			suggestLengthComparison: "Replace with `{{replacement}}`.",
			useLengthComparison: "Use `{{replacement}}` instead of comparing the string to ''.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowAutofix: {
						default: false,
						description:
							"Rewrite strict comparisons to `.length` automatically. Off by default because the rule cannot see types, and `.length` throws on a nullish operand.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default noUselessEmptyStringComparison;
