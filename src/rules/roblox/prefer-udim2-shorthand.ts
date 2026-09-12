import { createRule } from "$oxc-utilities/create-rule";
import {
	BINARY_EXPRESSION,
	IDENTIFIER,
	isBinaryExpression,
	isNamedGlobalCall,
	isPrivateIdentifier,
	isSpreadElement,
	LITERAL,
	UNARY_EXPRESSION,
} from "$oxc-utilities/oxc-utilities";
import { isNumber } from "$oxc-utilities/type-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

interface ArgumentsCollection {
	readonly offsetXText: string;
	readonly offsetYText: string;
	readonly scaleXText: string;
	readonly scaleYText: string;
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

function reconstructText(node: ESTree.Expression): string | undefined {
	switch (node.type) {
		case BINARY_EXPRESSION: {
			if (!isValidBinaryExpression(node)) return undefined;

			const { left, right } = node;
			const leftText = reconstructText(left);
			const rightText = reconstructText(right);
			if (leftText === undefined || rightText === undefined) return undefined;

			return `${leftText} ${node.operator} ${rightText}`;
		}

		case IDENTIFIER:
			return node.name;

		case LITERAL:
			return isNumber(node.value) ? String(node.value) : undefined;

		case UNARY_EXPRESSION: {
			const argumentText = reconstructText(node.argument);
			if (argumentText === undefined) return undefined;
			if (node.operator !== "+" && node.operator !== "-") return undefined;
			return `${node.operator}${argumentText}`;
		}

		default:
			return undefined;
	}
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

function evaluateExpression(node: ESTree.Expression): number | undefined {
	switch (node.type) {
		case BINARY_EXPRESSION: {
			/* v8 ignore start -- @preserve collectArguments rejects unsupported binary operators before evaluation. */
			if (!isValidBinaryExpression(node)) return undefined;
			/* v8 ignore stop -- @preserve */

			const { left, right } = node;
			const leftValue = evaluateExpression(left);
			const rightValue = evaluateExpression(right);
			if (leftValue === undefined || rightValue === undefined) return undefined;

			return evaluateBinaryOperation(node.operator, leftValue, rightValue);
		}

		case IDENTIFIER:
			return undefined;

		case LITERAL:
			return Number(node.value);

		case UNARY_EXPRESSION: {
			const argumentValue = evaluateExpression(node.argument);
			if (argumentValue === undefined) return undefined;
			if (node.operator === "+") return argumentValue;
			/* v8 ignore next -- @preserve reconstructText admits only plus and minus unary expressions before evaluation. */
			if (node.operator === "-") return -argumentValue;
			/* v8 ignore next -- @preserve reconstructText rejects unsupported unary operators before evaluation. */
			return undefined;
		}

		/* v8 ignore next -- @preserve collectArguments admits only expression types handled above. */
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

	const scaleXText = reconstructText(scaleXNode);
	const offsetXText = reconstructText(offsetXNode);
	const scaleYText = reconstructText(scaleYNode);
	const offsetYText = reconstructText(offsetYNode);

	if (
		scaleXText === undefined ||
		offsetXText === undefined ||
		scaleYText === undefined ||
		offsetYText === undefined
	) {
		return undefined;
	}

	return { offsetXText, offsetYText, scaleXText, scaleYText };
}

function areConcreteUDim2Arguments(
	parameters: ReadonlyArray<ESTree.Expression | ESTree.SpreadElement>,
): parameters is readonly [ESTree.Expression, ESTree.Expression, ESTree.Expression, ESTree.Expression] {
	if (parameters.length !== 4) return false;

	const [scaleXNode, offsetXNode, scaleYNode, offsetYNode] = parameters;
	return (
		scaleXNode !== undefined &&
		offsetXNode !== undefined &&
		scaleYNode !== undefined &&
		offsetYNode !== undefined &&
		!isSpreadElement(scaleXNode) &&
		!isSpreadElement(offsetXNode) &&
		!isSpreadElement(scaleYNode) &&
		!isSpreadElement(offsetYNode)
	);
}

const preferUDim2Shorthand = createRule("prefer-udim2-shorthand", "roblox", {
	create(context): Visitor {
		return {
			NewExpression(node): void {
				if (!isNamedGlobalCall(node, "UDim2")) return;

				const collected = collectArguments(node.arguments);
				if (collected === undefined) return;

				/* v8 ignore start -- @preserve collectArguments already rejects missing or spread arguments. */
				if (!areConcreteUDim2Arguments(node.arguments)) {
					return;
				}
				/* v8 ignore stop -- @preserve */

				const [scaleXNode, offsetXNode, scaleYNode, offsetYNode] = node.arguments;

				const scaleX = evaluateExpression(scaleXNode);
				const offsetX = evaluateExpression(offsetXNode);
				const scaleY = evaluateExpression(scaleYNode);
				const offsetY = evaluateExpression(offsetYNode);

				if (scaleX === 0 && offsetX === 0 && scaleY === 0 && offsetY === 0) return;

				if (offsetX === 0 && offsetY === 0) {
					context.report({
						fix(fixer) {
							return fixer.replaceText(
								node,
								`UDim2.fromScale(${collected.scaleXText}, ${collected.scaleYText})`,
							);
						},
						messageId: "preferFromScale",
						node,
					});
					return;
				}

				if (scaleX === 0 && scaleY === 0) {
					context.report({
						fix(fixer) {
							return fixer.replaceText(
								node,
								`UDim2.fromOffset(${collected.offsetXText}, ${collected.offsetYText})`,
							);
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
