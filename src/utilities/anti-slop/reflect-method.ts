// Vendored from src/shared/reflect-method.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted imports to oxlint-plugin-utilities and local path aliases.

import { getVariableByName } from "$oxc-utilities/ast-utilities";

import type { ESTree, SourceCode, Variable } from "oxlint-plugin-utilities";

function resolveVariable(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): undefined | Variable {
	return getVariableByName(sourceCode.getScope(identifier), identifier.name);
}

function isGlobalReflect(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	if (expression.type !== "Identifier" || expression.name !== "Reflect") return false;
	if (sourceCode.isGlobalReference(expression)) return true;
	const variable = resolveVariable(sourceCode, expression);
	return variable === undefined || variable.defs.length === 0;
}

/**
 * Checks whether a callee targets a named method on the global Reflect object.
 * @param sourceCode - Source text and scope information for the callee.
 * @param callee - The potential Reflect method call target.
 * @param methodName - The Reflect method to match.
 * @returns Whether the callee invokes the named global Reflect method.
 */
export function isGlobalReflectMethodCall(
	sourceCode: SourceCode,
	callee: ESTree.Expression,
	methodName: string,
): boolean {
	if (!("property" in callee) || !("object" in callee) || !("computed" in callee)) return false;
	if (!isGlobalReflect(sourceCode, callee.object)) return false;
	return callee.computed
		? callee.property.type === "Literal" && callee.property.value === methodName
		: callee.property.type === "Identifier" && callee.property.name === methodName;
}
