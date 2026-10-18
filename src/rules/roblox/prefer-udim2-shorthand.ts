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
import { isNumber } from "$oxc-utilities/type-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

interface AnalyzedExpression {
	readonly text: string;
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

function analyzeExpression(node: ESTree.Expression): AnalyzedExpression | undefined {
	switch (node.type) {
		case BINARY_EXPRESSION: {
			if (!isValidBinaryExpression(node)) return undefined;

			const left = analyzeExpression(node.left);
			const right = analyzeExpression(node.right);
			if (left === undefined || right === undefined) return undefined;

			return {
				text: `${left.text} ${node.operator} ${right.text}`,
				value: combineValues(node.operator, left.value, right.value),
			};
		}

		case IDENTIFIER:
			return { text: node.name, value: undefined };

		case LITERAL:
			return isNumber(node.value) ? { text: String(node.value), value: node.value } : undefined;

		case UNARY_EXPRESSION: {
			const argument = analyzeExpression(node.argument);
			if (argument === undefined) return undefined;
			if (node.operator !== "+" && node.operator !== "-") return undefined;

			return {
				text: `${node.operator}${argument.text}`,
				value: node.operator === "-" ? negateValue(argument.value) : argument.value,
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
							return fixer.replaceText(node, `UDim2.fromScale(${scaleX.text}, ${scaleY.text})`);
						},
						messageId: "preferFromScale",
						node,
					});
					return;
				}

				if (isZeroScale) {
					context.report({
						fix(fixer) {
							return fixer.replaceText(node, `UDim2.fromOffset(${offsetX.text}, ${offsetY.text})`);
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
