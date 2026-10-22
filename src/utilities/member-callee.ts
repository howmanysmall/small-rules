import { isMemberExpression } from "@small-rules/oxlint-utilities";

import { getMemberPropertyName, stripExpressionWrappers } from "$oxc-utilities/oxc-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

/**
 * Gets the callee of a non-optional `receiver.method(...)` call, looking
 * through parentheses and TypeScript expression wrappers.
 *
 * @param node - Call expression to inspect.
 * @param methodName - Property name the callee must access.
 * @returns The unwrapped member callee, or undefined when the call or member
 *   access is optional or names a different property.
 */
export function getMethodCallee(node: ESTree.CallExpression, methodName: string): ESTree.MemberExpression | undefined {
	if (node.optional) return undefined;

	const callee = stripExpressionWrappers(node.callee);
	if (!isMemberExpression(callee) || callee.optional) return undefined;
	return getMemberPropertyName(callee) === methodName ? callee : undefined;
}

/**
 * Gets the callee of a call when it is a non-computed member access.
 *
 * @param node - Call expression to inspect.
 * @param node.callee - Callee of the call.
 * @returns The member callee, or undefined for any other callee shape.
 */
export function getStaticMemberCallee({ callee }: ESTree.CallExpression): ESTree.MemberExpression | undefined {
	return isMemberExpression(callee) && !callee.computed ? callee : undefined;
}
