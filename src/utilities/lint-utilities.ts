import {
	isCallExpression,
	isCallbackFunction,
	isIdentifier,
	isVariableDeclarator,
} from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";

import { isUppercaseName } from "$oxc-utilities/string-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

export function isHookCall(node: ESTree.Node | null, hookName: ReadonlySet<string> | string): boolean {
	return (
		isCallExpression(node) &&
		isIdentifier(node.callee) &&
		(Predicate.isString(hookName) ? node.callee.name === hookName : hookName.has(node.callee.name))
	);
}

export function isComponentAssignment(node: ESTree.Node): boolean {
	return (
		isVariableDeclarator(node) &&
		isIdentifier(node.id) &&
		isUppercaseName(node.id.name) &&
		isCallbackFunction(node.init)
	);
}
