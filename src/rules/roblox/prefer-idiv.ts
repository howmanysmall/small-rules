import {
	isAnyLiteral,
	isBinaryExpression,
	isIdentifierNamed,
	isNumericLiteral,
	isSpreadElement,
} from "@small-rules/oxlint-utilities";

import { hasShadowedBinding } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { getMethodCallee } from "$oxc-utilities/member-callee";
import { getReceiverText, stripExpressionWrappers, stripParenthesis } from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

function isLiteral(expression: ESTree.Expression): boolean {
	return isAnyLiteral(stripExpressionWrappers(expression));
}

function getReciprocalDivisor(expression: ESTree.Expression): number | undefined {
	const literal = stripExpressionWrappers(expression);
	if (!isNumericLiteral(literal)) return undefined;

	const { value } = literal;
	if (value <= 0 || value >= 1) return undefined;

	const divisor = 1 / value;
	return Number.isInteger(divisor) ? divisor : undefined;
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

interface IntegerDivisionTarget {
	readonly divisorText: string;
	readonly receiver: ESTree.Expression;
}

function getSlashIntegerDivisionTarget(
	sourceCode: SourceCode,
	expression: ESTree.BinaryExpression,
): IntegerDivisionTarget | undefined {
	if (expression.operator !== "/") return undefined;

	return {
		divisorText: sourceCode.getText(stripParenthesis(expression.right)),
		receiver: expression.left,
	};
}

function getStarIntegerDivisionTarget(expression: ESTree.BinaryExpression): IntegerDivisionTarget | undefined {
	if (expression.operator !== "*") return undefined;

	const rightDivisor = getReciprocalDivisor(expression.right);
	if (rightDivisor !== undefined && !isLiteral(expression.left)) {
		return { divisorText: String(rightDivisor), receiver: expression.left };
	}

	const leftDivisor = getReciprocalDivisor(expression.left);
	if (leftDivisor === undefined || isLiteral(expression.right)) return undefined;

	return { divisorText: String(leftDivisor), receiver: expression.right };
}

function getIntegerDivisionTarget(
	sourceCode: SourceCode,
	expression: ESTree.BinaryExpression,
): IntegerDivisionTarget | undefined {
	return getSlashIntegerDivisionTarget(sourceCode, expression) ?? getStarIntegerDivisionTarget(expression);
}

const preferIdiv = createRule("prefer-idiv", "roblox", {
	createOnce(context): Visitor {
		return {
			CallExpression(node): void {
				const callee = getMethodCallee(node, "floor");
				if (callee === undefined) return;

				const object = stripExpressionWrappers(callee.object);
				if (!isUnshadowedMathReference(context.sourceCode, object)) return;

				const argument = getSingleCallArgument(node);
				if (argument === undefined) return;

				const expression = stripExpressionWrappers(argument);
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
