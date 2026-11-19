import {
	FOR_STATEMENT,
	isExpressionStatement,
	isTsSatisfiesExpression,
	isTypeAssertionExpression,
} from "@small-rules/oxlint-utilities";

import { isAutofixAllowed } from "$oxc-utilities/autofix-option";
import { createRule } from "$oxc-utilities/create-rule";
import { reportWithReplacement } from "$oxc-utilities/replacement-report";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

function isStandaloneUpdateExpression(node: ESTree.UpdateExpression): boolean {
	const { parent } = node;
	return isExpressionStatement(parent) || (parent.type === FOR_STATEMENT && parent.update === node);
}

const OPERATOR_LENGTH = "++".length;

function getOperandText(sourceCode: SourceCode, node: ESTree.UpdateExpression): string {
	const { argument } = node;
	if (!isTypeAssertionExpression(argument) && !isTsSatisfiesExpression(argument)) return sourceCode.getText(argument);

	// The argument node omits the parentheses of `(a as T)`, and `a as T += 1`
	// does not parse, so slice around the operator.
	const [start, end] = node.range;
	const text = node.prefix
		? sourceCode.text.slice(start + OPERATOR_LENGTH, end)
		: sourceCode.text.slice(start, end - OPERATOR_LENGTH);

	return text.trim();
}

const noIncrementDecrement = createRule("no-increment-decrement", "general", {
	create(context): Visitor {
		const allowAutofix = isAutofixAllowed(context.options[0]);
		const { sourceCode } = context;

		return {
			UpdateExpression(node): void {
				if (!isStandaloneUpdateExpression(node)) return;

				const argumentText = getOperandText(sourceCode, node);
				const messageId = node.operator === "++" ? "noIncrement" : "noDecrement";

				if (!allowAutofix) {
					context.report({
						messageId,
						node,
					});
					return;
				}

				const replacement = node.operator === "++" ? `${argumentText} += 1` : `${argumentText} -= 1`;

				reportWithReplacement(context, messageId, node, replacement);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow standalone `++` and `--` statements and for-loop update clauses.",
			recommended: true,
		},
		fixable: "code",
		messages: {
			noDecrement: "Do not use standalone `--`. Use `-= 1` instead.",
			noIncrement: "Do not use standalone `++`. Use `+= 1` instead.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowAutofix: {
						default: false,
						description: "Allow the fixer to replace standalone ++ and -- statements and for-loop updates.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default noIncrementDecrement;
