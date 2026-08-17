import { isUppercaseName } from "$oxc-utilities/string-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

const SIMPLE_BINARY_OPERATORS = new Set(["%", "*", "**", "+", "-", "/"]);

export function isComponentDeclaration(node: ESTree.Node): boolean {
	return node.type === "FunctionDeclaration" && node.id !== null && isUppercaseName(node.id.name);
}

export function isMemoCall(node: ESTree.Node): boolean {
	if (node.type !== "CallExpression") return false;
	if (node.callee.type === "Identifier") return node.callee.name === "memo";

	return (
		node.callee.type === "MemberExpression" &&
		node.callee.object.type === "Identifier" &&
		node.callee.object.name === "React" &&
		node.callee.property.type === "Identifier" &&
		node.callee.property.name === "memo"
	);
}

export function isReactComponentHigherOrderCall({ callee }: ESTree.CallExpression): boolean {
	if (callee.type === "Identifier") return callee.name === "forwardRef" || callee.name === "memo";

	return (
		callee.type === "MemberExpression" &&
		callee.object.type === "Identifier" &&
		callee.object.name === "React" &&
		callee.property.type === "Identifier" &&
		(callee.property.name === "forwardRef" || callee.property.name === "memo")
	);
}

export function getJSXAttributeName({ name }: ESTree.JSXAttribute): string | undefined {
	return name.type === "JSXIdentifier" ? name.name : name.name.name;
}

export function hasJSXIdentifierAttribute(node: ESTree.JSXElement, attributeName: string): boolean {
	for (const attribute of node.openingElement.attributes) {
		if (
			attribute.type === "JSXAttribute" &&
			attribute.name.type === "JSXIdentifier" &&
			attribute.name.name === attributeName
		) {
			return true;
		}
	}

	return false;
}

function pushSimpleExpressionChildren(node: ESTree.Node, nodes: Array<ESTree.Node>): boolean {
	switch (node.type) {
		case "BinaryExpression": {
			if (!SIMPLE_BINARY_OPERATORS.has(node.operator)) return false;
			nodes.push(node.right, node.left);
			return true;
		}

		case "Identifier":
		case "Literal": {
			return true;
		}

		case "MemberExpression": {
			if (node.computed) return false;
			nodes.push(node.object);
			return true;
		}

		case "ParenthesizedExpression": {
			nodes.push(node.expression);
			return true;
		}

		case "TemplateLiteral": {
			return node.expressions.length === 0;
		}

		case "UnaryExpression": {
			nodes.push(node.argument);
			return true;
		}

		default: {
			return false;
		}
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
