import { isStringLiteral } from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const EQUALITY_OPERATORS = new Set(["!=", "!==", "==", "==="]);
const NEGATED_OPERATORS = new Set(["!=", "!=="]);

function isEmptyStringLiteral(node: ESTree.Node): boolean {
	return isStringLiteral(node) && node.value === "";
}

const noUselessEmptyStringComparison = createRule("no-useless-empty-string-comparison", "general", {
	createOnce(context): Visitor {
		return {
			BinaryExpression(node): void {
				if (!EQUALITY_OPERATORS.has(node.operator)) return;

				const operand = isEmptyStringLiteral(node.left) ? node.right : node.left;
				if (operand === node.left && !isEmptyStringLiteral(node.right)) return;

				const text = context.sourceCode.getText(operand);
				context.report({
					data: { replacement: NEGATED_OPERATORS.has(node.operator) ? text : `!${text}` },
					messageId: "emptyStringComparison",
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
		messages: {
			emptyStringComparison: "Use `{{replacement}}` instead of comparing to an empty string.",
		},
		schema: [],
		type: "problem",
	},
});

export default noUselessEmptyStringComparison;
