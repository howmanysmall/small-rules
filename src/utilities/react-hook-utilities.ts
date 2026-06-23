import { unwrapExpression } from "$oxc-utilities/ast-utilities";
import { isKeyOfNode, isNode } from "$oxc-utilities/oxc-utilities";

import { isStringRaw } from "./type-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

const SETTER_IDENTIFIER_PATTERN = /^set[A-Z]/u;

export function getHookName({ callee }: ESTree.CallExpression): string | undefined {
	if (callee.type === "Identifier") return callee.name;
	if (callee.type === "MemberExpression" && callee.property.type === "Identifier") return callee.property.name;
	return undefined;
}

export function isSetterIdentifier(name: string): boolean {
	return SETTER_IDENTIFIER_PATTERN.test(name);
}

export function getEffectCallback(callExpression: ESTree.CallExpression): CallbackFunction | undefined {
	const [callback] = callExpression.arguments;
	return callback?.type === "ArrowFunctionExpression" || callback?.type === "FunctionExpression"
		? callback
		: undefined;
}

export function walkAst(node: ESTree.Node, callback: (child: ESTree.Node) => void): void {
	const stack = [node];
	while (stack.length > 0) {
		const current = stack.pop();
		/* v8 ignore next -- @preserve The loop condition guarantees pop returns a node. */
		if (current === undefined) break;
		callback(current);
		pushChildNodes(current, stack);
	}
}

export function walkAstSlop(node: ESTree.Node, callback: (child: ESTree.Node) => void): void {
	callback(node);

	for (const child of Object.values(node)) {
		walkChildSlop(child, node, callback);
	}
}

function pushChildNodes(node: ESTree.Node, stack: Array<ESTree.Node>): void {
	// biome-ignore lint/suspicious/noForIn: required for AST traversal
	for (const key in node) {
		if (isKeyOfNode(key)) continue;
		pushChildValue(Reflect.get(node, key), node, stack);
	}
}

function pushChildValue(value: unknown, parent: ESTree.Node, stack: Array<ESTree.Node>): void {
	if (typeof value !== "object" || value === null || value === parent.parent) return;

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

function walkChildSlop(value: unknown, parent: ESTree.Node, callback: (child: ESTree.Node) => void): void {
	if (Array.isArray(value)) {
		for (const item of value) walkChildSlop(item, parent, callback);
		return;
	}

	if (value === parent.parent || !isNode(value)) return;
	walkAstSlop(value, callback);
}

export function getBindingPropertyKeyName(property: ESTree.BindingProperty): string | undefined {
	const { key } = property;
	if (key.type === "Identifier") return key.name;
	if (key.type === "Literal" && isStringRaw(key.value)) return key.value;
	return undefined;
}

export function getBindingPropertyValueIdentifier(
	property: ESTree.BindingProperty,
): ESTree.BindingIdentifier | undefined {
	const { value } = property;
	if (value.type === "Identifier") return value;
	if (value.type === "AssignmentPattern" && value.left.type === "Identifier") return value.left;
	return undefined;
}

export function countSetStateCalls(node: ESTree.Node): number {
	let count = 0;

	walkAst(node, (child) => {
		if (child.type !== "CallExpression" || child.callee.type !== "Identifier") return;
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
	if (argument.type === "SpreadElement") return DependenciesKind.DynamicOrUnknown;

	const expression = unwrapExpression(argument);
	if (expression.type !== "ArrayExpression") return DependenciesKind.DynamicOrUnknown;
	if (expression.elements.length === 0) return DependenciesKind.EmptyArray;
	if (isStaticArrayExpression(sourceCode, expression, seen, options)) return DependenciesKind.StaticArray;

	return DependenciesKind.DynamicOrUnknown;
}
