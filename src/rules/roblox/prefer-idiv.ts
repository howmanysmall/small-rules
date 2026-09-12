import { hasShadowedBinding } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	getMemberPropertyName,
	isAnyLiteral,
	isBinaryExpression,
	isCallExpression,
	isIdentifierName,
	isIdentifierNamed,
	isMemberExpression,
	isNewExpression,
	isNumericLiteral,
	isSpreadElement,
	isThisExpression,
	unwrapExpression,
	unwrapParenthesis,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

function isSimpleReceiver(expression: ESTree.Expression): boolean {
	return (
		isIdentifierName(expression) ||
		isMemberExpression(expression) ||
		isCallExpression(expression) ||
		isNewExpression(expression) ||
		isThisExpression(expression)
	);
}

function isLiteral(expression: ESTree.Expression): boolean {
	return isAnyLiteral(unwrapExpression(expression));
}

function getReciprocalDivisor(expression: ESTree.Expression): number | undefined {
	const literal = unwrapExpression(expression);
	if (!isNumericLiteral(literal)) return undefined;

	const { value } = literal;
	if (value <= 0 || value >= 1) return undefined;

	const divisor = 1 / value;
	return Number.isInteger(divisor) ? divisor : undefined;
}

function getReceiverText(sourceCode: SourceCode, receiver: ESTree.Expression): string {
	const receiverText = sourceCode.getText(unwrapParenthesis(receiver));
	return isSimpleReceiver(unwrapExpression(receiver)) ? receiverText : `(${receiverText})`;
}

function isMathFloorCallee(callee: ESTree.Expression): callee is ESTree.MemberExpression {
	return isMemberExpression(callee) && !callee.optional && getMemberPropertyName(callee) === "floor";
}

function isUnshadowedMathReference(sourceCode: SourceCode, object: ESTree.Expression): boolean {
	return isIdentifierNamed(object, "math") && !hasShadowedBinding(sourceCode, object, "math");
}

function getSingleCallArgument(node: ESTree.CallExpression): ESTree.Expression | undefined {
	if (node.arguments.length !== 1) return undefined;

	const [argument] = node.arguments;
	if (argument === undefined || isSpreadElement(argument)) return undefined;

	return argument;
}

interface IdivTarget {
	readonly divisorText: string;
	readonly receiver: ESTree.Expression;
}

function getSlashIdivTarget(sourceCode: SourceCode, expression: ESTree.BinaryExpression): IdivTarget | undefined {
	if (expression.operator !== "/") return undefined;

	return {
		divisorText: sourceCode.getText(unwrapParenthesis(expression.right)),
		receiver: expression.left,
	};
}

function getStarIdivTarget(expression: ESTree.BinaryExpression): IdivTarget | undefined {
	if (expression.operator !== "*") return undefined;

	const rightDivisor = getReciprocalDivisor(expression.right);
	if (rightDivisor !== undefined && !isLiteral(expression.left)) {
		return { divisorText: String(rightDivisor), receiver: expression.left };
	}

	const leftDivisor = getReciprocalDivisor(expression.left);
	if (leftDivisor === undefined || isLiteral(expression.right)) return undefined;

	return { divisorText: String(leftDivisor), receiver: expression.right };
}

function getIntegerDivisionTarget(sourceCode: SourceCode, expression: ESTree.BinaryExpression): IdivTarget | undefined {
	return getSlashIdivTarget(sourceCode, expression) ?? getStarIdivTarget(expression);
}

const preferIdiv = createRule("prefer-idiv", "roblox", {
	createOnce(context): Visitor {
		return {
			CallExpression(node): void {
				if (node.optional) return;

				const callee = unwrapExpression(node.callee);
				if (!isMathFloorCallee(callee)) return;

				const object = unwrapExpression(callee.object);
				if (!isUnshadowedMathReference(context.sourceCode, object)) return;

				const argument = getSingleCallArgument(node);
				if (argument === undefined) return;

				const expression = unwrapExpression(argument);
				if (!isBinaryExpression(expression)) return;

				const target = getIntegerDivisionTarget(context.sourceCode, expression);
				if (target === undefined) return;

				context.report({
					fix: (fixer) =>
						fixer.replaceText(
							node,
							`${getReceiverText(context.sourceCode, target.receiver)}.idiv(${target.divisorText})`,
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
