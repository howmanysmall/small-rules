// Vendored from src/shared/reflect-method.ts@13909c9e07590f5a85d93c62712259fe14a883f7 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted imports to oxlint-plugin-utilities and local path aliases.

import { isAnyLiteral, isIdentifierNamed } from "@small-rules/oxlint-utilities";

import { hasShadowedBinding } from "$oxc-utilities/ast-utilities";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

function isGlobalReflect(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	return isIdentifierNamed(expression, "Reflect") && !hasShadowedBinding(sourceCode, expression, "Reflect");
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
		? isAnyLiteral(callee.property) && callee.property.value === methodName
		: isIdentifierNamed(callee.property, methodName);
}
