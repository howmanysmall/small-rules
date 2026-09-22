import { getVariableByName, hasShadowedBinding } from "$oxc-utilities/ast-utilities";
import {
	getImportedName,
	isCallExpression,
	isIdentifierName,
	isIdentifierNamed,
	isImportDeclaration,
	isImportNamespaceSpecifier,
	isImportSpecifier,
	isMemberExpression,
	isNewExpression,
	isVariableDeclaration,
	isVariableDeclarator,
	unwrapExpression,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Variable } from "oxlint-plugin-utilities";

export type NativeCollectionKind = "Map" | "Set";

const JECS_SOURCES = new Set(["@rbxts/jecs"]);
const PROMISE_CHAIN_METHODS = new Set(["catch", "finally", "then"]);
const PROMISE_FACTORY_METHODS = new Set(["all", "allSettled", "any", "race", "reject", "resolve"]);
const MAX_ALIAS_DEPTH = 8;

function getSingleConstantInitializer(variable: undefined | Variable): ESTree.Expression | undefined {
	if (variable?.defs.length !== 1) return undefined;

	const [definition] = variable.defs;
	if (definition?.type !== "Variable" || !isVariableDeclarator(definition.node)) return undefined;

	const declaration = definition.node.parent;
	if (!isVariableDeclaration(declaration) || declaration.kind !== "const") return undefined;

	return definition.node.init ?? undefined;
}

function isImportFromJecs(node: ESTree.Node): boolean {
	const declaration = node.parent;
	return isImportDeclaration(declaration) && JECS_SOURCES.has(declaration.source.value);
}

function isJecsWorldFactoryVariable(variable: undefined | Variable): boolean {
	if (variable === undefined) return false;
	return variable.defs.some((definition) => {
		if (definition.type !== "ImportBinding" || !isImportSpecifier(definition.node)) return false;
		return isImportFromJecs(definition.node) && getImportedName(definition.node) === "world";
	});
}

function isJecsNamespaceVariable(variable: undefined | Variable): boolean {
	/* v8 ignore next -- callers obtain this variable from a resolved namespace identifier. @preserve */
	if (variable === undefined) return false;
	return variable.defs.some(
		(definition) =>
			definition.type === "ImportBinding" &&
			isImportNamespaceSpecifier(definition.node) &&
			isImportFromJecs(definition.node),
	);
}

function isJecsWorldFactoryCall(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	if (!isCallExpression(unwrapped)) return false;

	const { callee } = unwrapped;
	if (isIdentifierName(callee)) {
		return isJecsWorldFactoryVariable(getVariableByName(sourceCode.getScope(callee), callee.name));
	}
	/* v8 ignore next -- remaining callable forms cannot identify the Jecs world factory. @preserve */
	if (!isMemberExpression(callee) || callee.computed || !isIdentifierNamed(callee.property, "world")) return false;
	if (!isIdentifierName(callee.object)) return false;
	return isJecsNamespaceVariable(getVariableByName(sourceCode.getScope(callee.object), callee.object.name));
}

export function isJecsWorldExpression(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	if (!isIdentifierName(unwrapped)) return false;

	const initializer = getSingleConstantInitializer(getVariableByName(sourceCode.getScope(unwrapped), unwrapped.name));
	return initializer !== undefined && isJecsWorldFactoryCall(sourceCode, initializer);
}

function isGlobalNativeConstructor(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	name: "Map" | "Promise" | "Set",
): boolean {
	const unwrapped = unwrapExpression(expression);
	return isIdentifierNamed(unwrapped, name) && !hasShadowedBinding(sourceCode, unwrapped, name);
}

function getNativeCollectionKindAtDepth(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	depth: number,
): NativeCollectionKind | undefined {
	if (depth >= MAX_ALIAS_DEPTH) return undefined;

	const unwrapped = unwrapExpression(expression);
	if (isNewExpression(unwrapped)) {
		if (isGlobalNativeConstructor(sourceCode, unwrapped.callee, "Map")) return "Map";
		if (isGlobalNativeConstructor(sourceCode, unwrapped.callee, "Set")) return "Set";
		return undefined;
	}
	if (!isIdentifierName(unwrapped)) return undefined;

	const initializer = getSingleConstantInitializer(getVariableByName(sourceCode.getScope(unwrapped), unwrapped.name));
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
	const unwrapped = unwrapExpression(expression);
	if (isNewExpression(unwrapped)) {
		return isGlobalNativeConstructor(sourceCode, unwrapped.callee, "Promise");
	}

	if (isIdentifierName(unwrapped)) {
		const variable = getVariableByName(sourceCode.getScope(unwrapped), unwrapped.name);
		const initializer = getSingleConstantInitializer(variable);
		return initializer !== undefined && isNativePromiseExpressionAtDepth(sourceCode, initializer, depth + 1);
	}

	if (!isCallExpression(unwrapped)) return false;

	const { callee } = unwrapped;
	if (!isMemberExpression(callee) || callee.computed || !isIdentifierName(callee.property)) return false;

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
