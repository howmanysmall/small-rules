import { unwrapExpression } from "$oxc-utilities/ast-utilities";
import {
	isArrayExpression,
	isBinaryExpression,
	isConditionalExpression,
	isLiteral,
	isLogicalExpression,
	isMemberExpression,
	isObjectExpression,
	isSequenceExpression,
	isTemplateLiteral,
	isThisExpression,
	isUnaryExpression,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

function isComputedPropertyKeySafe(key: ESTree.PropertyKey): boolean {
	if (key.type === "Identifier") return true;
	if (key.type === "PrivateIdentifier") return true;
	return isExpressionSideEffectSafe(key);
}

export function isExpressionSideEffectSafe(expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);

	if (unwrapped.type === "Identifier") return true;
	if (isThisExpression(unwrapped)) return true;

	if (isMemberExpression(unwrapped)) return isMemberSideEffectSafe(unwrapped);
	if (isUnaryExpression(unwrapped)) {
		return unwrapped.operator !== "delete" && isExpressionSideEffectSafe(unwrapped.argument);
	}
	if (isBinaryExpression(unwrapped) || isLogicalExpression(unwrapped)) return arePairExpressionsSafe(unwrapped);
	if (isConditionalExpression(unwrapped)) return isConditionalSideEffectSafe(unwrapped);
	if (isTemplateLiteral(unwrapped)) return areExpressionsSafe(unwrapped.expressions);
	if (isArrayExpression(unwrapped)) return isArraySideEffectSafe(unwrapped);
	if (isObjectExpression(unwrapped)) return isObjectSideEffectSafe(unwrapped);
	if (isSequenceExpression(unwrapped)) return areExpressionsSafe(unwrapped.expressions);

	return isLiteral(unwrapped);
}

function isMemberSideEffectSafe(expression: ESTree.MemberExpression): boolean {
	if (expression.optional || expression.object.type === "Super") return false;
	if (!isExpressionSideEffectSafe(expression.object)) return false;
	return !expression.computed || isExpressionSideEffectSafe(expression.property);
}

function arePairExpressionsSafe(expression: ESTree.BinaryExpression | ESTree.LogicalExpression): boolean {
	return isExpressionSideEffectSafe(expression.left) && isExpressionSideEffectSafe(expression.right);
}

function isConditionalSideEffectSafe(expression: ESTree.ConditionalExpression): boolean {
	return (
		isExpressionSideEffectSafe(expression.test) &&
		isExpressionSideEffectSafe(expression.consequent) &&
		isExpressionSideEffectSafe(expression.alternate)
	);
}

function isArraySideEffectSafe(expression: ESTree.ArrayExpression): boolean {
	for (const element of expression.elements) {
		if (element === null) continue;
		if (element.type === "SpreadElement") return false;
		if (!isExpressionSideEffectSafe(element)) return false;
	}

	return true;
}

function isObjectSideEffectSafe(expression: ESTree.ObjectExpression): boolean {
	for (const property of expression.properties) {
		if (property.type === "SpreadElement" || property.kind !== "init" || property.method) return false;
		if (property.computed && !isComputedPropertyKeySafe(property.key)) return false;
		if (!isExpressionSideEffectSafe(property.value)) return false;
	}

	return true;
}

function areExpressionsSafe(expressions: ReadonlyArray<ESTree.Expression>): boolean {
	for (const expression of expressions) if (!isExpressionSideEffectSafe(expression)) return false;
	return true;
}
