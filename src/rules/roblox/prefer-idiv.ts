import { getMemberPropertyName, hasShadowedBinding, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

function isSimpleReceiver({ type }: ESTree.Expression): boolean {
	return (
		type === "Identifier" ||
		type === "MemberExpression" ||
		type === "CallExpression" ||
		type === "NewExpression" ||
		type === "ThisExpression"
	);
}

function stripParenthesizedExpression(expression: ESTree.Expression): ESTree.Expression {
	let current = expression;
	while (current.type === "ParenthesizedExpression") current = current.expression;
	return current;
}

function isLiteral(expression: ESTree.Expression): boolean {
	return unwrapExpression(expression).type === "Literal";
}

function getReciprocalDivisor(expression: ESTree.Expression): number | undefined {
	const literal = unwrapExpression(expression);
	if (literal.type !== "Literal" || typeof literal.value !== "number") return undefined;

	const { value } = literal;
	if (value <= 0 || value >= 1) return undefined;

	const divisor = 1 / value;
	return Number.isInteger(divisor) ? divisor : undefined;
}

function getReceiverText(sourceCode: SourceCode, receiver: ESTree.Expression): string {
	const receiverText = sourceCode.getText(stripParenthesizedExpression(receiver));
	return isSimpleReceiver(unwrapExpression(receiver)) ? receiverText : `(${receiverText})`;
}

const preferIdiv = createRule("prefer-idiv", "roblox", {
	createOnce(context): Visitor {
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
				if (expression.type !== "BinaryExpression") return;

				let receiver: ESTree.Expression;
				let divisorText: string;

				if (expression.operator === "/") {
					receiver = expression.left;
					divisorText = context.sourceCode.getText(stripParenthesizedExpression(expression.right));
				} else if (expression.operator === "*") {
					const rightDivisor = getReciprocalDivisor(expression.right);
					if (rightDivisor !== undefined && !isLiteral(expression.left)) {
						receiver = expression.left;
						divisorText = String(rightDivisor);
					} else {
						const leftDivisor = getReciprocalDivisor(expression.left);
						if (leftDivisor === undefined || isLiteral(expression.right)) return;

						receiver = expression.right;
						divisorText = String(leftDivisor);
					}
				} else return;

				context.report({
					fix: (fixer) =>
						fixer.replaceText(
							node,
							`${getReceiverText(context.sourceCode, receiver)}.idiv(${divisorText})`,
						),
					messageId: "useIdiv",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prefer .idiv() for integer division instead of math.floor(x / y) or math.floor(x * 0.5).",
			recommended: true,
		},
		fixable: "code",
		messages: {
			useIdiv: "Use .idiv() instead of math.floor(x / y) or math.floor(x * 0.5) for integer division.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default preferIdiv;
