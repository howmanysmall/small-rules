import {
	isAnyFunction,
	isCallExpression,
	isConditionalExpression,
	isIdentifier,
	isIdentifierNamed,
	isIfStatement,
	isLoopNode,
	isMemberExpression,
	isSwitchCase,
	isTryStatement,
} from "@small-rules/oxlint-utilities";

import { getMemberPropertyName } from "$oxc-utilities/oxc-utilities";
import { walkAst } from "$oxc-utilities/react-hook-utilities";

import type { CallbackFunction } from "@small-rules/oxlint-utilities";
import type { ESTree } from "oxlint-plugin-utilities";

export interface ExpectCallCount {
	readonly deterministic: number;
	readonly hasExpectInCallback: boolean;
	readonly hasExpectInLoop: boolean;
	readonly hasIndeterminate: boolean;
	readonly indeterminate: number;
}

interface ExpectContext {
	readonly hasCallback: boolean;
	readonly hasIndeterminate: boolean;
	readonly hasLoop: boolean;
}

function isTestIdentifier(node: ESTree.Node): node is ESTree.IdentifierName {
	return isIdentifier(node) && (node.name === "it" || node.name === "test");
}

function isTestModifierCall(node: ESTree.CallExpression): boolean {
	if (!isMemberExpression(node.callee) || !isTestIdentifier(node.callee.object)) return false;

	const propertyName = getMemberPropertyName(node.callee);
	return propertyName === "only" || propertyName === "skip";
}

function isEachFactoryCall(node: ESTree.CallExpression): boolean {
	if (!isMemberExpression(node.callee) || !isTestIdentifier(node.callee.object)) return false;

	return getMemberPropertyName(node.callee) === "each";
}

function getLastCallbackArgument(node: ESTree.CallExpression): CallbackFunction | undefined {
	const lastArgument = node.arguments.at(-1);
	return lastArgument === undefined || !isAnyFunction(lastArgument) ? undefined : lastArgument;
}

function isSameNode(left: ESTree.Node, right: ESTree.Node): boolean {
	return left.type === right.type && left.range[0] === right.range[0] && left.range[1] === right.range[1];
}

function mergeExpectContext(left: ExpectContext, right: ExpectContext): ExpectContext {
	return {
		hasCallback: left.hasCallback || right.hasCallback,
		hasIndeterminate: left.hasIndeterminate || right.hasIndeterminate,
		hasLoop: left.hasLoop || right.hasLoop,
	};
}

function getExpectContext(currentParent: ESTree.Node, root: ESTree.Node): ExpectContext {
	if (isSameNode(currentParent, root)) {
		return {
			hasCallback: false,
			hasIndeterminate: false,
			hasLoop: false,
		};
	}

	const ownContext: ExpectContext = {
		hasCallback: isAnyFunction(currentParent),
		hasIndeterminate:
			isAnyFunction(currentParent) ||
			isLoopNode(currentParent) ||
			isConditionalExpression(currentParent) ||
			isIfStatement(currentParent) ||
			isSwitchCase(currentParent) ||
			(isTryStatement(currentParent) && currentParent.handler !== null),
		hasLoop: isLoopNode(currentParent),
	};

	/* v8 ignore next -- @preserve Parser traversal sets parent links before expect-call context is inspected. */
	if (currentParent.parent === null) return ownContext;
	return mergeExpectContext(ownContext, getExpectContext(currentParent.parent, root));
}

export function isTestCaseCall(node: ESTree.CallExpression): boolean {
	if (isIdentifier(node.callee)) return isTestIdentifier(node.callee);
	if (isTestModifierCall(node)) return true;
	if (isCallExpression(node.callee)) return isEachFactoryCall(node.callee);
	return false;
}

/** Test-only helper: exercised by the rule test-suite, not by plugin code. */
// oxlint-disable-next-line jsdoc/require-returns jsdoc/require-param -- useless
export function getTestCallback(node: ESTree.CallExpression): CallbackFunction | undefined {
	/* v8 ignore next -- @preserve callers request callbacks only after identifying test case calls. */
	return isTestCaseCall(node) ? getLastCallbackArgument(node) : undefined;
}

export function isExpectAssertionsCall({ callee }: ESTree.CallExpression): boolean {
	if (!isMemberExpression(callee) || !isIdentifierNamed(callee.object, "expect")) return false;
	return getMemberPropertyName(callee) === "assertions";
}

export function isExpectHasAssertionsCall({ callee }: ESTree.CallExpression): boolean {
	if (!isMemberExpression(callee) || !isIdentifierNamed(callee.object, "expect")) return false;
	return getMemberPropertyName(callee) === "hasAssertions";
}

function isExpectCall(
	{ callee }: ESTree.CallExpression,
	additionalAssertionFunctions: ReadonlyArray<string> = [],
): boolean {
	return isIdentifier(callee) && (callee.name === "expect" || additionalAssertionFunctions.includes(callee.name));
}

export function countExpectCalls(
	body: ESTree.Node,
	additionalAssertionFunctions: ReadonlyArray<string> = [],
): ExpectCallCount {
	let deterministic = 0;
	let hasExpectInCallback = false;
	let hasExpectInLoop = false;
	let hasIndeterminate = false;
	let indeterminate = 0;

	walkAst(body, (child): void => {
		if (!isCallExpression(child) || !isExpectCall(child, additionalAssertionFunctions)) return;

		const expectContext = getExpectContext(child.parent, body);
		if (expectContext.hasLoop) hasExpectInLoop = true;
		if (expectContext.hasCallback) hasExpectInCallback = true;

		if (expectContext.hasIndeterminate) {
			hasIndeterminate = true;
			indeterminate += 1;
			return;
		}

		deterministic += 1;
	});

	return {
		deterministic,
		hasExpectInCallback,
		hasExpectInLoop,
		hasIndeterminate,
		indeterminate,
	};
}
