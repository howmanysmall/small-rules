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

	if (isMemberExpression(unwrapped)) {
		if (unwrapped.optional || unwrapped.object.type === "Super") return false;
		if (!isExpressionSideEffectSafe(unwrapped.object)) return false;
		if (!unwrapped.computed) return true;
		return isExpressionSideEffectSafe(unwrapped.property);
	}

	if (isUnaryExpression(unwrapped)) {
		if (unwrapped.operator === "delete") return false;
		return isExpressionSideEffectSafe(unwrapped.argument);
	}

	if (isBinaryExpression(unwrapped) || isLogicalExpression(unwrapped)) {
		return isExpressionSideEffectSafe(unwrapped.left) && isExpressionSideEffectSafe(unwrapped.right);
	}

	if (isConditionalExpression(unwrapped)) {
		return (
			isExpressionSideEffectSafe(unwrapped.test) &&
			isExpressionSideEffectSafe(unwrapped.consequent) &&
			isExpressionSideEffectSafe(unwrapped.alternate)
		);
	}

	if (isTemplateLiteral(unwrapped)) {
		for (const part of unwrapped.expressions) if (!isExpressionSideEffectSafe(part)) return false;
		return true;
	}

	if (isArrayExpression(unwrapped)) {
		for (const element of unwrapped.elements) {
			if (element === null) continue;
			if (element.type === "SpreadElement") return false;
			if (!isExpressionSideEffectSafe(element)) return false;
		}
		return true;
	}

	if (isObjectExpression(unwrapped)) {
		for (const property of unwrapped.properties) {
			if (property.type === "SpreadElement" || property.kind !== "init" || property.method) return false;
			if (property.computed && !isComputedPropertyKeySafe(property.key)) return false;
			if (!isExpressionSideEffectSafe(property.value)) return false;
		}
		return true;
	}

	if (isSequenceExpression(unwrapped)) {
		for (const value of unwrapped.expressions) if (!isExpressionSideEffectSafe(value)) return false;
		return true;
	}

	return isLiteral(unwrapped);
}
