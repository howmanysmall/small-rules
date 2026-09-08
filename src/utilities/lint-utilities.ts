import { Predicate } from "effect";

import { isUppercaseName } from "$oxc-utilities/string-utilities";

import { isCallbackFunction, isCallExpression, isIdentifierName, isVariableDeclarator } from "./oxc-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

export function isHookCall(node: ESTree.Node | null, hookName: ReadonlySet<string> | string): boolean {
	return (
		isCallExpression(node) &&
		isIdentifierName(node.callee) &&
		(Predicate.isString(hookName) ? node.callee.name === hookName : hookName.has(node.callee.name))
	);
}

export function isComponentAssignment(node: ESTree.Node): boolean {
	return (
		isVariableDeclarator(node) &&
		isIdentifierName(node.id) &&
		isUppercaseName(node.id.name) &&
		isCallbackFunction(node.init)
	);
}
