import {
	isCallExpression,
	isChainExpression,
	isIdentifierNamed,
	isMemberExpression,
	isStringLiteral,
} from "@small-rules/oxlint-utilities";

import { isNodeTypeName } from "./node-types.ts";

import type { ESTree } from "oxlint-plugin-utilities";

const EQUALITY_OPERATORS = new Set<string>(["!=", "!==", "==", "==="]);

export function isEqualityOperator(operator: string): boolean {
	return EQUALITY_OPERATORS.has(operator);
}

/**
 * The `.type` access an expression makes: `node.type` itself, or the access
 * inside `node?.type`.
 *
 * @param node - Expression that may read a `.type` property.
 * @returns The member access, or `undefined` for any other expression.
 */
export function getTypeReadMember(node: ESTree.Node): ESTree.MemberExpression | undefined {
	const member = isChainExpression(node) ? node.expression : node;
	if (!isMemberExpression(member) || member.computed) return undefined;
	if (!isIdentifierNamed(member.property, "type")) return undefined;
	return member;
}

export function getNodeTypeLiteral(node: ESTree.Node | null): ESTree.StringLiteral | undefined {
	return isStringLiteral(node) && isNodeTypeName(node.value) ? node : undefined;
}

/**
 * `node.type` and `getNodeType(node)` both produce a node type.
 *
 * @param node - Expression on the other side of a comparison.
 * @returns Whether the expression produces a node type.
 */
function producesNodeType(node: ESTree.Node): boolean {
	return getTypeReadMember(node) !== undefined || isCallExpression(node);
}

export function collectComparedNodeTypes(
	{ left, operator, right }: ESTree.BinaryExpression | ESTree.PrivateInExpression,
	literals: Array<ESTree.StringLiteral>,
): void {
	if (!isEqualityOperator(operator)) return;

	const leftLiteral = getNodeTypeLiteral(left);
	if (leftLiteral !== undefined && producesNodeType(right)) literals.push(leftLiteral);

	const rightLiteral = getNodeTypeLiteral(right);
	if (rightLiteral !== undefined && producesNodeType(left)) literals.push(rightLiteral);
}

export function collectCaseNodeTypes(
	{ cases, discriminant }: ESTree.SwitchStatement,
	literals: Array<ESTree.StringLiteral>,
): void {
	if (!producesNodeType(discriminant)) return;
	for (const { test } of cases) {
		const literal = getNodeTypeLiteral(test);
		if (literal !== undefined) literals.push(literal);
	}
}

/**
 * An array counts only when every element is a node type, so a list of type
 * names such as `["JSXElement", "ReactNode"]` is left alone.
 *
 * @param array - Array literal to inspect.
 * @param literals - Receives the elements when all of them are node types.
 */
export function collectArrayNodeTypes(
	{ elements }: ESTree.ArrayExpression,
	literals: Array<ESTree.StringLiteral>,
): void {
	const start = literals.length;
	for (const element of elements) {
		const literal = getNodeTypeLiteral(element);
		if (literal === undefined) {
			literals.length = start;
			return;
		}
		literals.push(literal);
	}
}
