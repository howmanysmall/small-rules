import { getMemberPropertyName, hasShadowedBinding, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isSimpleReceiver({ type }: ESTree.Expression): boolean {
	return (
		type === "Identifier" ||
		type === "MemberExpression" ||
		type === "CallExpression" ||
		type === "NewExpression" ||
		type === "ThisExpression"
	);
}

const preferIdiv = defineRule({
	create(context): Visitor {
		return {
			CallExpression(node): void {
				if (node.optional) return;

				const callee = unwrapExpression(node.callee);
				if (
					callee.type !== "MemberExpression" ||
					callee.optional ||
					getMemberPropertyName(callee) !== "floor"
				) {
					return;
				}

				const object = unwrapExpression(callee.object);
				if (
					object.type !== "Identifier" ||
					object.name !== "math" ||
					hasShadowedBinding(context.sourceCode, object, "math") ||
					node.arguments.length !== 1
				) {
					return;
				}

				const [argument] = node.arguments;
				if (argument === undefined || argument.type === "SpreadElement") return;

				const expression = unwrapExpression(argument);
				if (expression.type !== "BinaryExpression" || expression.operator !== "/") return;

				const left = unwrapExpression(expression.left);
				const leftText = context.sourceCode.getText(expression.left);
				const receiverText = isSimpleReceiver(left) ? leftText : `(${leftText})`;
				const rightText = context.sourceCode.getText(expression.right);

				context.report({
					fix: (fixer) => fixer.replaceText(node, `${receiverText}.idiv(${rightText})`),
					messageId: "useIdiv",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prefer .idiv() for integer division instead of math.floor(x / y).",
			recommended: true,
		},
		fixable: "code",
		messages: {
			useIdiv: "Use .idiv() instead of math.floor(x / y) for integer division.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default preferIdiv;
