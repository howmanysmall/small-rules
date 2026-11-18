import { isChainExpression, isStringLiteral } from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";
import { isAllowAutofixOption } from "$oxc-utilities/option-utilities";
import { getReceiverText, stripParenthesis } from "$oxc-utilities/oxc-utilities";

import type { ESTree, FixFn, SourceCode, Visitor } from "oxlint-plugin-utilities";

const STRICT_OPERATORS = new Set(["!==", "==="]);
const EQUALITY_OPERATORS = new Set(["!=", "!==", "==", "==="]);

function isEmptyStringLiteral(node: ESTree.Node): boolean {
	return isStringLiteral(node) && node.value.length === 0;
}

function createReplacementFix(node: ESTree.BinaryExpression, replacement: string): FixFn {
	return (fixer) => fixer.replaceText(node, replacement);
}

interface AutofixOptions {
	readonly allowAutofix?: boolean;
}

function isAutofixEnabled(options?: AutofixOptions): boolean {
	return isAllowAutofixOption(options) && options.allowAutofix === true;
}

/**
 * A nullish chain makes `.length` yield `undefined`, which flips the result,
 * and replacing the node's text would drop any comment inside it.
 *
 * @param sourceCode - The source code of the linted file.
 * @param node - The comparison being rewritten.
 * @param receiverNode - The operand that is not the empty string.
 * @returns Whether the `.length` rewrite would change the code's meaning.
 */
function isLengthRewriteUnsafe(
	sourceCode: SourceCode,
	node: ESTree.BinaryExpression,
	receiverNode: ESTree.Expression,
): boolean {
	return isChainExpression(stripParenthesis(receiverNode)) || sourceCode.getCommentsInside(node).length > 0;
}

const noUselessEmptyStringComparison = createRule("no-useless-empty-string-comparison", "general", {
	createOnce(context): Visitor {
		return {
			BinaryExpression(node): void {
				if (!EQUALITY_OPERATORS.has(node.operator)) return;

				const leftIsEmpty = isEmptyStringLiteral(node.left);
				if (!leftIsEmpty && !isEmptyStringLiteral(node.right)) return;

				if (!STRICT_OPERATORS.has(node.operator)) {
					context.report({ messageId: "looseEmptyStringComparison", node });
					return;
				}

				const receiverNode = leftIsEmpty ? node.right : node.left;
				const receiver = getReceiverText(context.sourceCode, receiverNode);
				const replacement = node.operator === "===" ? `${receiver}.length === 0` : `${receiver}.length > 0`;

				if (isLengthRewriteUnsafe(context.sourceCode, node, receiverNode)) {
					context.report({ data: { replacement }, messageId: "useLengthComparison", node });
					return;
				}

				const fix = createReplacementFix(node, replacement);
				if (isAutofixEnabled(context.options[0])) {
					context.report({ data: { replacement }, fix, messageId: "useLengthComparison", node });
					return;
				}

				context.report({
					data: { replacement },
					messageId: "useLengthComparison",
					node,
					suggest: [{ data: { replacement }, fix, messageId: "suggestLengthComparison" }],
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
