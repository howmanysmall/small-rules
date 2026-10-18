import {
	isCallExpression,
	isIdentifier,
	isIdentifierNamed,
	isMemberExpression,
	isNewExpression,
} from "@small-rules/oxlint-utilities";

import { getVariableByName, hasShadowedBinding } from "$oxc-utilities/ast-utilities";
import { isImportedCallee } from "$oxc-utilities/import-binding-provenance";
import { stripExpressionWrappers } from "$oxc-utilities/oxc-utilities";
import { getSingleConstInitializer } from "$oxc-utilities/single-variable-definition";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

export type NativeCollectionKind = "Map" | "Set";

const JECS_SOURCES = new Set(["@rbxts/jecs"]);
const PROMISE_CHAIN_METHODS = new Set(["catch", "finally", "then"]);
const PROMISE_FACTORY_METHODS = new Set(["all", "allSettled", "any", "race", "reject", "resolve"]);
const MAX_ALIAS_DEPTH = 8;

function isJecsWorldFactoryCall(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	const unwrapped = stripExpressionWrappers(expression);
	return isCallExpression(unwrapped) && isImportedCallee(sourceCode, unwrapped.callee, JECS_SOURCES, "world");
}

export function isJecsWorldExpression(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	const unwrapped = stripExpressionWrappers(expression);
	if (!isIdentifier(unwrapped)) return false;

	const initializer = getSingleConstInitializer(getVariableByName(sourceCode.getScope(unwrapped), unwrapped.name));
	return initializer !== undefined && isJecsWorldFactoryCall(sourceCode, initializer);
}

function isGlobalNativeConstructor(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	name: "Array" | "Map" | "Promise" | "Set",
): boolean {
	const unwrapped = stripExpressionWrappers(expression);
	return isIdentifierNamed(unwrapped, name) && !hasShadowedBinding(sourceCode, unwrapped, name);
}

export function isGlobalArrayConstructor(sourceCode: SourceCode, node: ESTree.NewExpression): boolean {
	return isGlobalNativeConstructor(sourceCode, node.callee, "Array");
}

function getNativeCollectionKindAtDepth(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	depth: number,
): NativeCollectionKind | undefined {
	if (depth >= MAX_ALIAS_DEPTH) return undefined;

	const unwrapped = stripExpressionWrappers(expression);
	if (isNewExpression(unwrapped)) {
		if (isGlobalNativeConstructor(sourceCode, unwrapped.callee, "Map")) return "Map";
		if (isGlobalNativeConstructor(sourceCode, unwrapped.callee, "Set")) return "Set";
		return undefined;
	}
	if (!isIdentifier(unwrapped)) return undefined;

	const initializer = getSingleConstInitializer(getVariableByName(sourceCode.getScope(unwrapped), unwrapped.name));
	return initializer === undefined ? undefined : getNativeCollectionKindAtDepth(sourceCode, initializer, depth + 1);
}

export function getNativeCollectionKind(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
): NativeCollectionKind | undefined {
	return getNativeCollectionKindAtDepth(sourceCode, expression, 0);
}

function isNativePromiseExpressionAtDepth(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	depth: number,
): boolean {
	if (depth >= MAX_ALIAS_DEPTH) return false;
	const unwrapped = stripExpressionWrappers(expression);
	if (isNewExpression(unwrapped)) {
		return isGlobalNativeConstructor(sourceCode, unwrapped.callee, "Promise");
	}

	if (isIdentifier(unwrapped)) {
		const variable = getVariableByName(sourceCode.getScope(unwrapped), unwrapped.name);
		const initializer = getSingleConstInitializer(variable);
		return initializer !== undefined && isNativePromiseExpressionAtDepth(sourceCode, initializer, depth + 1);
	}

	if (!isCallExpression(unwrapped)) return false;

	const { callee } = unwrapped;
	if (!isMemberExpression(callee) || callee.computed || !isIdentifier(callee.property)) return false;

	if (isGlobalNativeConstructor(sourceCode, callee.object, "Promise")) {
		return PROMISE_FACTORY_METHODS.has(callee.property.name);
	}
	return (
		PROMISE_CHAIN_METHODS.has(callee.property.name) &&
		isNativePromiseExpressionAtDepth(sourceCode, callee.object, depth + 1)
	);
}

export function isNativePromiseExpression(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	return isNativePromiseExpressionAtDepth(sourceCode, expression, 0);
}
