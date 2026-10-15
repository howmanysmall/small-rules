import { isStringLiteral } from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";
import { getReceiverText } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const EQUALITY_OPERATORS = new Set(["!=", "!==", "==", "==="]);

function isEmptyStringLiteral(node: ESTree.Node): boolean {
	return isStringLiteral(node) && node.value === "";
}

const noUselessEmptyStringComparison = createRule("no-useless-empty-string-comparison", "general", {
	createOnce(context): Visitor {
		return {
			BinaryExpression(node): void {
				if (!EQUALITY_OPERATORS.has(node.operator)) return;

				const leftIsEmpty = isEmptyStringLiteral(node.left);
				if (!leftIsEmpty && !isEmptyStringLiteral(node.right)) return;

				const receiver = getReceiverText(context.sourceCode, leftIsEmpty ? node.right : node.left);
				const replacement = `${receiver}.length ${node.operator} 0`;
				context.report({
					data: { replacement },
					fix(fixer) {
						return fixer.replaceText(node, replacement);
					},
					messageId: "useLengthComparison",
					node,
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
		messages: {
			useLengthComparison: "Use `{{replacement}}` instead of comparing the string to ''.",
		},
		schema: [],
		type: "problem",
	},
});

export default noUselessEmptyStringComparison;
