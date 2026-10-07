import {
	CHAIN_EXPRESSION,
	isBindingIdentifier,
	isCallExpression,
	isIdentifier,
	isIdentifierNamed,
	isMemberExpression,
	isParenthesizedExpression,
	isStringLiteral,
	isTsParenthesizedType,
	isTsTypeAnnotationUnknown,
	isTsTypeReference,
	PARENTHESIZED_EXPRESSION,
	TS_AS_EXPRESSION,
	TS_INSTANTIATION_EXPRESSION,
	TS_NON_NULL_EXPRESSION,
	TS_SATISFIES_EXPRESSION,
	TS_TYPE_ASSERTION,
} from "@small-rules/oxlint-utilities";

import type { TypeAssertionExpression } from "@small-rules/oxlint-utilities";
import type { ESTree } from "oxlint-plugin-utilities";

const COMPONENT_NAME_PATTERN = /^[A-Z]/v;

export type KeyOfNode = "end" | "loc" | "parent" | "range" | "start" | "type";
const KEY_OF_NODE = new Set<KeyOfNode>(["end", "loc", "parent", "range", "start", "type"]);

export function isKeyOfNode(key: string): key is KeyOfNode {
	return KEY_OF_NODE.has(key);
}

export function isComponentName(name: string): boolean {
	return COMPONENT_NAME_PATTERN.test(name);
}

export function getTypeAnnotationFromBinding(binding: ESTree.BindingPattern): ESTree.TSTypeAnnotation | undefined {
	return isTsTypeAnnotationUnknown(binding.typeAnnotation) ? binding.typeAnnotation : undefined;
}

export function getNamespacedCallNames(
	callee: ESTree.Expression,
): undefined | { readonly objectName: string; readonly propertyName: string } {
	if (
		!isMemberExpression(callee) ||
		callee.computed ||
		!isIdentifier(callee.object) ||
		!isIdentifier(callee.property)
	) {
		return undefined;
	}

	return { objectName: callee.object.name, propertyName: callee.property.name };
}

export function isReactNamedCall(
	node: ESTree.CallExpression,
	identifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
	name: string,
): boolean {
	if (isIdentifier(node.callee)) return identifiers.has(node.callee.name);
	if (!isMemberExpression(node.callee) || !isIdentifier(node.callee.object)) return false;
	return reactNamespaces.has(node.callee.object.name) && getMemberPropertyName(node.callee) === name;
}

export function isUseMemoCall(
	node: ESTree.CallExpression,
	memoIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
): boolean {
	return isReactNamedCall(node, memoIdentifiers, reactNamespaces, "useMemo");
}

export function getImportedName({ imported }: ESTree.ImportSpecifier): string | undefined {
	return isIdentifier(imported) ? imported.name : imported.value;
}

export function isStaticRequire(node: ESTree.Node): node is ESTree.CallExpression {
	if (!isCallExpression(node) || node.optional) return false;

	const { callee } = node;
	if (!isIdentifierNamed(callee, "require") || node.arguments.length !== 1) return false;

	const [argument] = node.arguments;
	return argument !== undefined && isStringLiteral(argument);
}

export function isConstAssertion({ typeAnnotation }: TypeAssertionExpression): boolean {
	return isTsTypeReference(typeAnnotation) && isIdentifierNamed(typeAnnotation.typeName, "const");
}

export function stripParenthesizedType(type: ESTree.TSType): ESTree.TSType {
	let current = type;
	while (isTsParenthesizedType(current)) current = current.typeAnnotation;
	return current;
}

export function stripExpressionWrappers(expression: ESTree.Expression): ESTree.Expression {
	let current: ESTree.Expression = expression;

	while (true) {
		switch (current.type) {
			case CHAIN_EXPRESSION:
			case PARENTHESIZED_EXPRESSION:
			case TS_AS_EXPRESSION:
			case TS_INSTANTIATION_EXPRESSION:
			case TS_NON_NULL_EXPRESSION:
			case TS_SATISFIES_EXPRESSION:
			case TS_TYPE_ASSERTION: {
				current = current.expression;
				break;
			}

			default:
				return current;
		}
	}
}

export function stripParenthesis(expression: ESTree.Expression): ESTree.Expression {
	let current = expression;
	while (isParenthesizedExpression(current)) current = current.expression;
	return current;
}

export function getMemberPropertyName(node: ESTree.MemberExpression): string | undefined {
	if (node.computed) return isStringLiteral(node.property) ? node.property.value : undefined;

	/* v8 ignore next -- @preserve non-computed member properties are parser-provided identifiers. */
	return isBindingIdentifier(node.property) ? node.property.name : undefined;
}
