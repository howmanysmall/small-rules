import {
	BINARY_EXPRESSION,
	IDENTIFIER,
	isBinaryExpression,
	isNamedGlobalCall,
	isPrivateIdentifier,
	isSpreadElement,
	LITERAL,
	UNARY_EXPRESSION,
} from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";
import { stripParenthesis } from "$oxc-utilities/oxc-utilities";
import { isNumber } from "$oxc-utilities/type-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

interface AnalyzedExpression {
	readonly node: ESTree.Expression;
	readonly value: number | undefined;
}

interface ArgumentsCollection {
	readonly offsetX: AnalyzedExpression;
	readonly offsetY: AnalyzedExpression;
	readonly scaleX: AnalyzedExpression;
	readonly scaleY: AnalyzedExpression;
}

function isAllowedBinaryOperator(operator: ESTree.BinaryOperator): boolean {
	return operator === "+" || operator === "-" || operator === "*" || operator === "/" || operator === "%";
}

function isValidBinaryExpression(node: ESTree.Node): node is ESTree.BinaryExpression {
	return (
		isBinaryExpression(node) &&
		isAllowedBinaryOperator(node.operator) &&
		!isPrivateIdentifier(node.left) &&
		!isPrivateIdentifier(node.right)
	);
}

function evaluateBinaryOperation(operator: ESTree.BinaryOperator, left: number, right: number): number | undefined {
	switch (operator) {
		case "%":
			return right === 0 ? undefined : left % right;

		case "*":
			return left * right;

		case "+":
			return left + right;

		case "-":
			return left - right;

		case "/":
			return right === 0 ? undefined : left / right;

		/* v8 ignore next -- @preserve isValidBinaryExpression admits only operators handled above. */
		default:
			return undefined;
	}
}

function combineValues(operator: ESTree.BinaryOperator, left?: number, right?: number): number | undefined {
	return left === undefined || right === undefined ? undefined : evaluateBinaryOperation(operator, left, right);
}

function negateValue(value?: number): number | undefined {
	return value === undefined ? undefined : -value;
}

/**
 * Checks that an argument is simple arithmetic and folds its numeric value.
 *
 * @param node - The argument expression.
 * @returns The argument without wrapping parentheses and its value when it is
 *   a known number, or `undefined` when the argument is not simple arithmetic.
 */
function analyzeExpression(node: ESTree.Expression): AnalyzedExpression | undefined {
	const expression = stripParenthesis(node);

	switch (expression.type) {
		case BINARY_EXPRESSION: {
			if (!isValidBinaryExpression(expression)) return undefined;

			const left = analyzeExpression(expression.left);
			const right = analyzeExpression(expression.right);
			if (left === undefined || right === undefined) return undefined;

			return { node: expression, value: combineValues(expression.operator, left.value, right.value) };
		}

		case IDENTIFIER:
			return { node: expression, value: undefined };

		case LITERAL:
			return isNumber(expression.value) ? { node: expression, value: expression.value } : undefined;

		case UNARY_EXPRESSION: {
			const argument = analyzeExpression(expression.argument);
			if (argument === undefined) return undefined;
			if (expression.operator !== "+" && expression.operator !== "-") return undefined;

			return {
				node: expression,
				value: expression.operator === "-" ? negateValue(argument.value) : argument.value,
			};
		}

		default:
			return undefined;
	}
}

function collectArguments(
	parameters: ReadonlyArray<ESTree.Expression | ESTree.SpreadElement>,
): ArgumentsCollection | undefined {
	if (parameters.length !== 4) return undefined;

	const [scaleXNode, offsetXNode, scaleYNode, offsetYNode] = parameters;
	if (
		scaleXNode === undefined ||
		offsetXNode === undefined ||
		scaleYNode === undefined ||
		offsetYNode === undefined ||
		isSpreadElement(scaleXNode) ||
		isSpreadElement(offsetXNode) ||
		isSpreadElement(scaleYNode) ||
		isSpreadElement(offsetYNode)
	) {
		return undefined;
	}

	const scaleX = analyzeExpression(scaleXNode);
	const offsetX = analyzeExpression(offsetXNode);
	const scaleY = analyzeExpression(scaleYNode);
	const offsetY = analyzeExpression(offsetYNode);

	if (scaleX === undefined || offsetX === undefined || scaleY === undefined || offsetY === undefined) {
		return undefined;
	}

	return { offsetX, offsetY, scaleX, scaleY };
}

const preferUDim2Shorthand = createRule("prefer-udim2-shorthand", "roblox", {
	create(context): Visitor {
		const { sourceCode } = context;

		return {
			NewExpression(node): void {
				if (!isNamedGlobalCall(node, "UDim2")) return;

				const collected = collectArguments(node.arguments);
				if (collected === undefined) return;

				const { offsetX, offsetY, scaleX, scaleY } = collected;
				const isZeroOffset = offsetX.value === 0 && offsetY.value === 0;
				const isZeroScale = scaleX.value === 0 && scaleY.value === 0;

				if (isZeroScale && isZeroOffset) return;

				if (isZeroOffset) {
					context.report({
						fix(fixer) {
							const scaleXText = sourceCode.getText(scaleX.node);
							const scaleYText = sourceCode.getText(scaleY.node);
							return fixer.replaceText(node, `UDim2.fromScale(${scaleXText}, ${scaleYText})`);
						},
						messageId: "preferFromScale",
						node,
					});
					return;
				}

				if (isZeroScale) {
					context.report({
						fix(fixer) {
							const offsetXText = sourceCode.getText(offsetX.node);
							const offsetYText = sourceCode.getText(offsetY.node);
							return fixer.replaceText(node, `UDim2.fromOffset(${offsetXText}, ${offsetYText})`);
						},
						messageId: "preferFromOffset",
						node,
					});
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Prefer UDim2.fromScale() or UDim2.fromOffset() over new UDim2() when all offsets or all scales are zero.",
		},
		fixable: "code",
		messages: {
			preferFromOffset: "Use UDim2.fromOffset() instead of new UDim2() when all scales are 0.",
			preferFromScale: "Use UDim2.fromScale() instead of new UDim2() when all offsets are 0.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default preferUDim2Shorthand;
