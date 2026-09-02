import { isUppercaseName } from "$oxc-utilities/string-utilities";

import {
	BINARY_EXPRESSION,
	IDENTIFIER,
	isCallExpression,
	isFunctionDeclarationRaw,
	isIdentifierName,
	isJsxAttribute,
	isJsxIdentifier,
	isMemberExpression,
	LITERAL,
	MEMBER_EXPRESSION,
	PARENTHESIZED_EXPRESSION,
	TEMPLATE_LITERAL,
	UNARY_EXPRESSION,
} from "./oxc-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

const SIMPLE_BINARY_OPERATORS = new Set(["%", "*", "**", "+", "-", "/"]);

export function isComponentDeclaration(node: ESTree.Node): boolean {
	return isFunctionDeclarationRaw(node) && node.id !== null && isUppercaseName(node.id.name);
}

export function isMemoCall(node: ESTree.Node): boolean {
	if (!isCallExpression(node)) return false;
	if (isIdentifierName(node.callee)) return node.callee.name === "memo";

	return (
		isMemberExpression(node.callee) &&
		isIdentifierName(node.callee.object) &&
		node.callee.object.name === "React" &&
		isIdentifierName(node.callee.property) &&
		node.callee.property.name === "memo"
	);
}

export function isReactComponentHigherOrderCall({ callee }: ESTree.CallExpression): boolean {
	if (isIdentifierName(callee)) return callee.name === "forwardRef" || callee.name === "memo";

	return (
		isMemberExpression(callee) &&
		isIdentifierName(callee.object) &&
		callee.object.name === "React" &&
		isIdentifierName(callee.property) &&
		(callee.property.name === "forwardRef" || callee.property.name === "memo")
	);
}

export function getJSXAttributeName({ name }: ESTree.JSXAttribute): string | undefined {
	return isJsxIdentifier(name) ? name.name : name.name.name;
}

export function hasJSXIdentifierAttribute(node: ESTree.JSXElement, attributeName: string): boolean {
	for (const attribute of node.openingElement.attributes) {
		if (isJsxAttribute(attribute) && isJsxIdentifier(attribute.name) && attribute.name.name === attributeName) {
			return true;
		}
	}

	return false;
}

function pushSimpleExpressionChildren(node: ESTree.Node, nodes: Array<ESTree.Node>): boolean {
	switch (node.type) {
		case BINARY_EXPRESSION: {
			if (!SIMPLE_BINARY_OPERATORS.has(node.operator)) return false;
			nodes.push(node.right, node.left);
			return true;
		}

		case IDENTIFIER:
		case LITERAL:
			return true;

		case MEMBER_EXPRESSION: {
			if (node.computed) return false;
			nodes.push(node.object);
			return true;
		}

		case PARENTHESIZED_EXPRESSION: {
			nodes.push(node.expression);
			return true;
		}

		case TEMPLATE_LITERAL:
			return node.expressions.length === 0;

		case UNARY_EXPRESSION: {
			nodes.push(node.argument);
			return true;
		}

		default:
			return false;
	}
}

export function isSimpleExpression(node: ESTree.Node): boolean {
	const nodes = [node];
	while (nodes.length > 0) {
		const current = nodes.pop();
		/* v8 ignore next -- the loop guard ensures pop never returns undefined. @preserve */
		if (current === undefined) break;
		if (!pushSimpleExpressionChildren(current, nodes)) return false;
	}
	return true;
}
