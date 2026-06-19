import { isAllowAutofixOption } from "$oxc-utilities/option-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isStandaloneUpdateExpression(node: ESTree.UpdateExpression): boolean {
	const { parent } = node;
	return parent?.type === "ExpressionStatement" || (parent?.type === "ForStatement" && parent.update === node);
}

const noIncrementDecrement = defineRule({
	create(context): Visitor {
		const [options] = context.options;
		const allowAutofix = isAllowAutofixOption(options) && options.allowAutofix === true;
		const { sourceCode } = context;

		return {
			UpdateExpression(node): void {
				if (!isStandaloneUpdateExpression(node)) return;

				const argumentText = sourceCode.getText(node.argument);
				const messageId = node.operator === "++" ? "noIncrement" : "noDecrement";

				if (!allowAutofix) {
					context.report({
						messageId,
						node,
					});
					return;
				}

				const replacement = node.operator === "++" ? `${argumentText} += 1` : `${argumentText} -= 1`;

				context.report({
					fix(fixer) {
						return fixer.replaceText(node, replacement);
					},
					messageId,
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow standalone `++` and `--` statements.",
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
