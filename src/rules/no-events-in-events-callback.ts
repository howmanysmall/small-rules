import { getMemberPropertyName } from "$oxc-utilities/ast-utilities";
import { isNonEmptyString } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { BindingName, CallbackFunction } from "$oxc-types/missing-types";
import type { ESTree, Visitor } from "oxlint-plugin-utilities";

interface Options {
	readonly eventsImportPaths?: ReadonlyArray<string>;
}
const enum TaintKind {
	None = 0x00,
	Container = 0x01,
	Value = 0x02,
}

interface CallbackState {
	readonly playerContainers: Set<string>;
	readonly playerValues: Set<string>;
}

interface FunctionState {
	readonly callbackDepth: number;
	readonly callbackState: CallbackState | undefined;
}

function normalizeImportPaths(options?: Options): ReadonlySet<string> {
	const normalized = new Set<string>();
	if (!options?.eventsImportPaths) return normalized;

	/* v8 ignore next -- @preserve rule schema rejects non-string import paths. */
	for (const importPath of options.eventsImportPaths) {
		if (isNonEmptyString(importPath)) normalized.add(importPath);
	}

	return normalized;
}

function unwrapNode(node: ESTree.Node): ESTree.Node {
	/* v8 ignore next -- @preserve wrapper variants are parser-shape defensive cases. */
	switch (node.type) {
		case "ChainExpression":
		case "TSAsExpression":
		case "TSInstantiationExpression":
		case "TSNonNullExpression":
		case "TSTypeAssertion":
			return unwrapNode(node.expression);

		default:
			return node;
	}
}
function getRootIdentifierName(node: ESTree.Node): string | undefined {
	const unwrapped = unwrapNode(node);

	if (unwrapped.type === "Identifier") return unwrapped.name;
	if (unwrapped.type !== "MemberExpression") return undefined;

	return getRootIdentifierName(unwrapped.object);
}

function getConnectCallback(
	node: ESTree.CallExpression,
	eventsIdentifiers: ReadonlySet<string>,
): CallbackFunction | undefined {
	const unwrappedCallee = unwrapNode(node.callee);
	if (unwrappedCallee.type !== "MemberExpression") return undefined;
	if (getMemberPropertyName(unwrappedCallee) !== "connect") return undefined;

	const rootIdentifier = getRootIdentifierName(unwrappedCallee.object);
	if (rootIdentifier === undefined || !eventsIdentifiers.has(rootIdentifier)) return undefined;

	const [callbackArgument] = node.arguments;
	if (!callbackArgument) return undefined;

	switch (callbackArgument.type) {
		case "ArrowFunctionExpression":
		case "FunctionExpression":
			return callbackArgument;

		default:
			return undefined;
	}
}

function isEventsMethodCall(node: ESTree.CallExpression, eventsIdentifiers: ReadonlySet<string>): boolean {
	const unwrappedCallee = unwrapNode(node.callee);
	if (unwrappedCallee.type !== "MemberExpression") return false;

	const rootIdentifier = getRootIdentifierName(unwrappedCallee);
	return rootIdentifier === undefined ? false : eventsIdentifiers.has(rootIdentifier);
}

function addIfMissing(set: Set<string>, value: string): boolean {
	if (set.has(value)) return false;
	set.add(value);
	return true;
}

function markAsPlayerValue(name: string, state: CallbackState): boolean {
	return addIfMissing(state.playerValues, name);
}

function markAsPlayerContainer(name: string, state: CallbackState): boolean {
	return addIfMissing(state.playerContainers, name);
}

function markPatternValues(pattern: ESTree.Node, state: CallbackState): boolean {
	switch (pattern.type) {
		case "ArrayPattern": {
			let changed = false;
			for (const element of pattern.elements) {
				if (!element) continue;
				/* v8 ignore next -- @preserve duplicate pattern names only need to change taint once. */
				changed = markPatternValues(element, state) || changed;
			}
			return changed;
		}

		case "AssignmentPattern":
			return markPatternValues(pattern.left, state);

		case "Identifier":
			return markAsPlayerValue(pattern.name, state);

		case "ObjectPattern": {
			let changed = false;
			for (const property of pattern.properties) {
				if (property.type === "RestElement") {
					/* v8 ignore next -- @preserve duplicate pattern names only need to change taint once. */
					changed = markPatternValues(property.argument, state) || changed;
					continue;
				}

				/* v8 ignore next -- @preserve duplicate pattern names only need to change taint once. */
				changed = markPatternValues(property.value, state) || changed;
			}

			return changed;
		}

		case "RestElement":
			return markPatternValues(pattern.argument, state);

		/* v8 ignore start -- @preserve callers pass binding/assignment patterns handled above. */
		default:
			return false;
		/* v8 ignore stop -- @preserve */
	}
}

function markBindingPattern(
	pattern: BindingName | ESTree.AssignmentPattern,
	kind: TaintKind,
	state: CallbackState,
): boolean {
	/* v8 ignore start -- @preserve callers avoid marking untainted binding patterns. */
	if (kind === TaintKind.None) return false;
	/* v8 ignore stop -- @preserve */

	if (pattern.type === "Identifier") {
		if (kind === TaintKind.Value) return markAsPlayerValue(pattern.name, state);
		return markAsPlayerContainer(pattern.name, state);
	}

	return markPatternValues(pattern, state);
}

function markAssignmentTarget(target: ESTree.Node, kind: TaintKind, state: CallbackState): boolean {
	if (target.type === "MemberExpression" || kind === TaintKind.None) return false;

	/* v8 ignore next -- @preserve assignment targets are limited to handled pattern nodes. */
	if (
		target.type === "ArrayPattern" ||
		target.type === "AssignmentPattern" ||
		target.type === "Identifier" ||
		target.type === "ObjectPattern" ||
		target.type === "RestElement"
	) {
		if (target.type === "Identifier") {
			if (kind === TaintKind.Value) return markAsPlayerValue(target.name, state);
			return markAsPlayerContainer(target.name, state);
		}

		return markPatternValues(target, state);
	}

	/* v8 ignore start -- @preserve parser assignment targets reaching this rule are handled or rejected above. */
	return false;
	/* v8 ignore stop -- @preserve */
}

function classifyNodeTaint(node: ESTree.Node, state: CallbackState): TaintKind {
	const unwrapped = unwrapNode(node);

	switch (unwrapped.type) {
		case "ArrayExpression":
			return classifyArrayTaint(unwrapped, state);

		case "AssignmentExpression":
			return classifyNodeTaint(unwrapped.right, state);

		case "ConditionalExpression":
			return classifyConditionalTaint(unwrapped, state);

		case "Identifier": {
			if (state.playerValues.has(unwrapped.name)) return TaintKind.Value;
			if (state.playerContainers.has(unwrapped.name)) return TaintKind.Container;
			return TaintKind.None;
		}

		case "MemberExpression":
			return classifyMemberTaint(unwrapped, state);

		case "ObjectExpression":
			return classifyObjectTaint(unwrapped, state);

		case "SequenceExpression": {
			const lastExpression = unwrapped.expressions.at(-1);
			/* v8 ignore next -- @preserve parser sequence expressions have at least one expression. */
			return lastExpression === undefined ? TaintKind.None : classifyNodeTaint(lastExpression, state);
		}

		default:
			return TaintKind.None;
	}
}

function classifyArrayTaint(node: ESTree.ArrayExpression, state: CallbackState): TaintKind {
	for (const element of node.elements) {
		if (element === null) continue;

		const value = element.type === "SpreadElement" ? element.argument : element;
		if (classifyNodeTaint(value, state) !== TaintKind.None) return TaintKind.Container;
	}

	return TaintKind.None;
}

function classifyConditionalTaint(node: ESTree.ConditionalExpression, state: CallbackState): TaintKind {
	const consequent = classifyNodeTaint(node.consequent, state);
	const alternate = classifyNodeTaint(node.alternate, state);
	return consequent === alternate ? consequent : TaintKind.None;
}

function classifyMemberTaint(node: ESTree.MemberExpression, state: CallbackState): TaintKind {
	const objectKind = classifyNodeTaint(node.object, state);
	return objectKind === TaintKind.Container ? TaintKind.Value : TaintKind.None;
}

function classifyObjectTaint(node: ESTree.ObjectExpression, state: CallbackState): TaintKind {
	for (const property of node.properties) {
		/* v8 ignore next -- @preserve object expressions only expose properties and spreads here. */
		const value = property.type === "SpreadElement" ? property.argument : property.value;
		if (classifyNodeTaint(value, state) !== TaintKind.None) return TaintKind.Container;
	}

	return TaintKind.None;
}

function seedPlayerValueFromParameter(parameter: ESTree.Node, state: CallbackState): void {
	/* v8 ignore start -- @preserve Events.connect callbacks cannot declare constructor parameter properties. */
	if (parameter.type === "TSParameterProperty") {
		markPatternValues(parameter.parameter, state);
		return;
	}
	/* v8 ignore stop -- @preserve */

	markPatternValues(parameter, state);
}

const noEventsInEventsCallback = defineRule({
	create(context): Visitor {
		const allowedImportPaths = normalizeImportPaths(context.options[0]);
		const trackedEventsIdentifiers = new Set<string>();
		const callbackStateByFunction = new WeakMap<CallbackFunction, CallbackState>();
		const functionStack = new Array<FunctionState>();

		function getCurrentTopLevelCallbackState(): CallbackState | undefined {
			const current = functionStack.at(-1);
			if (!current?.callbackState) return undefined;
			if (current.callbackDepth > 0) return undefined;
			return current.callbackState;
		}

		function onFunctionEnter(node: CallbackFunction): void {
			if (node.type !== "FunctionDeclaration") {
				const callbackState = callbackStateByFunction.get(node);
				if (callbackState) {
					functionStack.push({ callbackDepth: 0, callbackState });
					return;
				}
			}

			const parentState = functionStack.at(-1);
			if (!parentState?.callbackState) {
				functionStack.push({ callbackDepth: 0, callbackState: undefined });
				return;
			}

			functionStack.push({
				callbackDepth: parentState.callbackDepth + 1,
				callbackState: parentState.callbackState,
			});
		}

		function onFunctionExit(): void {
			functionStack.pop();
		}

		return {
			ArrowFunctionExpression: onFunctionEnter,
			"ArrowFunctionExpression:exit": onFunctionExit,

			AssignmentExpression(node): void {
				const callbackState = getCurrentTopLevelCallbackState();
				if (!callbackState || node.operator !== "=") return;

				const taint = classifyNodeTaint(node.right, callbackState);
				if (taint === TaintKind.None) return;
				markAssignmentTarget(node.left, taint, callbackState);
			},

			CallExpression(node): void {
				const callback = getConnectCallback(node, trackedEventsIdentifiers);
				if (callback) {
					const callbackState: CallbackState = {
						playerContainers: new Set<string>(),
						playerValues: new Set<string>(),
					};

					const [playerParameter] = callback.params;
					if (playerParameter) seedPlayerValueFromParameter(playerParameter, callbackState);

					callbackStateByFunction.set(callback, callbackState);
				}

				const currentCallbackState = getCurrentTopLevelCallbackState();
				if (!(currentCallbackState && isEventsMethodCall(node, trackedEventsIdentifiers))) return;

				const [firstArgument] = node.arguments;
				if (
					!firstArgument ||
					firstArgument.type === "SpreadElement" ||
					classifyNodeTaint(firstArgument, currentCallbackState) !== TaintKind.Value
				) {
					return;
				}

				context.report({
					messageId: "preferFunctions",
					node,
				});
			},

			FunctionDeclaration: onFunctionEnter,
			"FunctionDeclaration:exit": onFunctionExit,
			FunctionExpression: onFunctionEnter,
			"FunctionExpression:exit": onFunctionExit,

			ImportDeclaration(node): void {
				const importSource = node.source.value;
				if (!allowedImportPaths.has(importSource)) return;

				for (const specifier of node.specifiers) {
					if (specifier.type === "ImportDefaultSpecifier") {
						if (specifier.local.name === "Events") trackedEventsIdentifiers.add(specifier.local.name);
						continue;
					}

					if (specifier.type !== "ImportSpecifier") continue;

					if (specifier.imported.type === "Identifier" && specifier.imported.name === "Events") {
						trackedEventsIdentifiers.add(specifier.local.name);
						continue;
					}

					if (specifier.imported.type === "Literal" && specifier.imported.value === "Events") {
						trackedEventsIdentifiers.add(specifier.local.name);
					}
				}
			},

			VariableDeclarator(node): void {
				const callbackState = getCurrentTopLevelCallbackState();
				if (!(callbackState && node.init)) return;

				const taint = classifyNodeTaint(node.init, callbackState);
				if (taint === TaintKind.None) return;

				markBindingPattern(node.id, taint, callbackState);
			},
		} satisfies Visitor;
	},

	meta: {
		docs: {
			description:
				"Disallow sending Events back to the same player inside an Events.connect callback; use Functions for request/response.",
		},
		messages: {
			preferFunctions:
				"Do not call Events for the same player inside an Events.connect callback. Use a Functions callback instead.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					eventsImportPaths: {
						description: "Import paths that identify Events objects whose callbacks should be checked.",
						items: {
							minLength: 1,
							type: "string",
						},
						type: "array",
					},
				},
				required: ["eventsImportPaths"],
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noEventsInEventsCallback;
