import { isNumber } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

interface ArgumentsCollection {
	readonly offsetXText: string;
	readonly offsetYText: string;
	readonly scaleXText: string;
	readonly scaleYText: string;
}

function isPrivateIdentifier(node: ESTree.Expression | ESTree.PrivateIdentifier): node is ESTree.PrivateIdentifier {
	return node.type === "PrivateIdentifier";
}

function isAllowedBinaryOperator(operator: ESTree.BinaryOperator): boolean {
	return operator === "+" || operator === "-" || operator === "*" || operator === "/" || operator === "%";
}

function reconstructText(node: ESTree.Expression): string | undefined {
	switch (node.type) {
		case "BinaryExpression": {
			if (!isAllowedBinaryOperator(node.operator)) return undefined;

			const { left, right } = node;
			if (isPrivateIdentifier(left) || isPrivateIdentifier(right)) return undefined;

			const leftText = reconstructText(left);
			const rightText = reconstructText(right);
			if (leftText === undefined || rightText === undefined) return undefined;

			return `${leftText} ${node.operator} ${rightText}`;
		}

		case "Identifier":
			return node.name;

		case "Literal":
			return isNumber(node.value) ? String(node.value) : undefined;

		case "UnaryExpression": {
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

		default:
			return undefined;
	}
}

function evaluateExpression(node: ESTree.Expression): number | undefined {
	switch (node.type) {
		case "BinaryExpression": {
			if (!isAllowedBinaryOperator(node.operator)) return undefined;
			const { left, right } = node;
			if (isPrivateIdentifier(left) || isPrivateIdentifier(right)) return undefined;

			const leftValue = evaluateExpression(left);
			const rightValue = evaluateExpression(right);
			if (leftValue === undefined || rightValue === undefined) return undefined;

			return evaluateBinaryOperation(node.operator, leftValue, rightValue);
		}

		case "Identifier":
			return undefined;

		case "Literal":
			return isNumber(node.value) ? node.value : undefined;

		case "UnaryExpression": {
			const argumentValue = evaluateExpression(node.argument);
			if (argumentValue === undefined) return undefined;
			if (node.operator === "+") return argumentValue;
			if (node.operator === "-") return -argumentValue;
			return undefined;
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
		scaleXNode.type === "SpreadElement" ||
		offsetXNode.type === "SpreadElement" ||
		scaleYNode.type === "SpreadElement" ||
		offsetYNode.type === "SpreadElement"
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

const preferUDim2Shorthand = defineRule({
	create(context): Visitor {
		return {
			NewExpression(node): void {
				if (node.callee.type !== "Identifier" || node.callee.name !== "UDim2") return;

				const collected = collectArguments(node.arguments);
				if (collected === undefined) return;

				const [scaleXNode, offsetXNode, scaleYNode, offsetYNode] = node.arguments;
				if (
					scaleXNode === undefined ||
					offsetXNode === undefined ||
					scaleYNode === undefined ||
					offsetYNode === undefined ||
					scaleXNode.type === "SpreadElement" ||
					offsetXNode.type === "SpreadElement" ||
					scaleYNode.type === "SpreadElement" ||
					offsetYNode.type === "SpreadElement"
				) {
					return;
				}

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
