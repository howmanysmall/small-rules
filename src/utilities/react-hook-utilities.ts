import {
	isArrayExpression,
	isAssignmentPattern,
	isCallbackFunction,
	isCallExpression,
	isIdentifier,
	isMemberExpression,
	isNode,
	isSpreadElement,
	isStringLiteral,
} from "@small-rules/oxlint-utilities";

import { isKeyOfNode, stripExpressionWrappers } from "$oxc-utilities/oxc-utilities";

import type { CallbackFunction } from "@small-rules/oxlint-utilities";
import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

const SETTER_IDENTIFIER_PATTERN = /^set[A-Z]/u;

export function getHookName({ callee }: ESTree.CallExpression): string | undefined {
	if (isIdentifier(callee)) return callee.name;
	if (isMemberExpression(callee) && isIdentifier(callee.property)) return callee.property.name;
	return undefined;
}

// oxlint-disable-next-line jsdoc-js/require-description jsdoc/empty-tags -- Stupid rule
/** @internal Exported for unit tests; not part of the published surface. */
// oxlint-disable-next-line jsdoc/require-returns jsdoc/require-param -- optimization
export function isSetterIdentifier(name: string): boolean {
	return SETTER_IDENTIFIER_PATTERN.test(name);
}

export function getEffectCallback(callExpression: ESTree.CallExpression): CallbackFunction | undefined {
	const [callback] = callExpression.arguments;
	return isCallbackFunction(callback) ? callback : undefined;
}

export function walkAst(node: ESTree.Node, callback: (child: ESTree.Node) => void): void {
	const worklist = [node];
	for (const current of worklist) {
		callback(current);
		pushChildNodes(current, worklist);
	}
}

export function walkAstSlop(node: ESTree.Node, callback: (child: ESTree.Node) => void): void {
	const worklist = [node];
	for (const current of worklist) {
		callback(current);
		for (const child of Object.values(current)) pushSlopValue(child, current, worklist);
	}
}

function pushChildNodes(node: ESTree.Node, stack: Array<ESTree.Node>): void {
	for (const [key, value] of Object.entries(node)) {
		if (isKeyOfNode(key)) continue;
		pushChildValue(value, node, stack);
	}
}

function pushChildValue(value: PropertyDescriptor["value"], parent: ESTree.Node, stack: Array<ESTree.Node>): void {
	if (value === null || value === undefined || value === parent.parent) return;

	if (Array.isArray(value)) {
		pushChildArray(value, parent, stack);
		return;
	}

	/* v8 ignore next -- @preserve parser object children that are not arrays are AST nodes here. */
	if (isNode(value)) stack.push(value);
}

function pushChildArray(values: ReadonlyArray<unknown>, parent: ESTree.Node, stack: Array<ESTree.Node>): void {
	for (let index = values.length - 1; index >= 0; index -= 1) {
		const value = values[index];
		/* v8 ignore next -- @preserve AST child arrays produced by the parser do not contain parent links. */
		if (value === parent.parent) continue;
		/* v8 ignore next -- @preserve parser child arrays traversed here contain AST nodes. */
		if (isNode(value)) stack.push(value);
	}
}

function pushSlopValue(value: PropertyDescriptor["value"], parent: ESTree.Node, worklist: Array<ESTree.Node>): void {
	if (Array.isArray(value)) {
		for (const item of value) pushSlopValue(item, parent, worklist);
		return;
	}

	if (value === parent.parent || !isNode(value)) return;
	worklist.push(value);
}

export function getBindingPropertyKeyName({ key }: ESTree.BindingProperty): string | undefined {
	if (isIdentifier(key)) return key.name;
	if (isStringLiteral(key)) return key.value;
	return undefined;
}

export function getBindingPropertyValueIdentifier({
	value,
}: ESTree.BindingProperty): ESTree.BindingIdentifier | undefined {
	if (isIdentifier(value)) return value;
	if (isAssignmentPattern(value) && isIdentifier(value.left)) return value.left;
	return undefined;
}

export function countSetStateCalls(node: ESTree.Node): number {
	let count = 0;

	walkAst(node, (child) => {
		if (!isCallExpression(child) || !isIdentifier(child.callee)) return;
		if (isSetterIdentifier(child.callee.name)) count += 1;
	});

	return count;
}

export const enum DependenciesKind {
	MissingOrOmitted = 0,
	EmptyArray = 1,
	StaticArray = 2,
	DynamicOrUnknown = 3,
}
export type IsStaticArrayExpression<TOptions extends object> = (
	sourceCode: SourceCode,
	arrayExpression: ESTree.ArrayExpression,
	seen: Set<ESTree.Node>,
	options: TOptions,
) => boolean;
export function classifyDependencies<TOptions extends object>(
	sourceCode: SourceCode,
	argument: ESTree.Argument | undefined,
	seen: Set<ESTree.Node>,
	options: TOptions,
	isStaticArrayExpression: IsStaticArrayExpression<TOptions>,
): DependenciesKind {
	if (argument === undefined) return DependenciesKind.MissingOrOmitted;
	if (isSpreadElement(argument)) return DependenciesKind.DynamicOrUnknown;

	const expression = stripExpressionWrappers(argument);
	if (!isArrayExpression(expression)) return DependenciesKind.DynamicOrUnknown;
	if (expression.elements.length === 0) return DependenciesKind.EmptyArray;
	if (isStaticArrayExpression(sourceCode, expression, seen, options)) return DependenciesKind.StaticArray;

	return DependenciesKind.DynamicOrUnknown;
}
