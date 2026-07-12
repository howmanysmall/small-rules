import { getVariableByName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { isCallbackFunction, isUseMemoCall } from "$oxc-utilities/oxc-utilities";
import { trackUseMemoImports } from "$oxc-utilities/react-memo-utilities";
import { getReactSources } from "$oxc-utilities/react-utilities";
import { isNumber, isRecord, isStringArray } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { Environment } from "$oxc-utilities/react-utilities";
import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

interface NormalizedOptions {
	readonly constructors: ReadonlySet<string>;
	readonly environment: Environment;
	readonly maxHelperTraceDepth: number;
}

interface FunctionInfo {
	readonly callees: Set<number>;
	readonly callIdentifiers: Array<ESTree.IdentifierReference>;
	readonly id: number;
}

interface TrackedNewExpression {
	readonly constructorName: string;
	readonly containingFunctionId: number | undefined;
	readonly isLexicallyInsideUseMemo: boolean;
	readonly node: ESTree.NewExpression;
}

interface TraversalState {
	readonly depth: number;
	readonly functionId: number;
}

const DEFAULT_CONSTRUCTORS = new Set(["Instance"]);
const DEFAULT_MAX_HELPER_TRACE_DEPTH = 4;

function normalizeOptions(raw: unknown): NormalizedOptions {
	const constructors =
		isRecord(raw) && isStringArray(raw.constructors) ? new Set(raw.constructors) : DEFAULT_CONSTRUCTORS;

	const environment = isRecord(raw) && raw.environment === "standard" ? "standard" : "roblox-ts";

	const candidateDepth = isRecord(raw) ? raw.maxHelperTraceDepth : undefined;
	const maxHelperTraceDepth =
		isNumber(candidateDepth) && Number.isInteger(candidateDepth) && candidateDepth >= 0
			? candidateDepth
			: DEFAULT_MAX_HELPER_TRACE_DEPTH;

	return { constructors, environment, maxHelperTraceDepth };
}

function isCallExpression(node: ESTree.Node | null): node is ESTree.CallExpression {
	return node?.type === "CallExpression";
}

function isInsideUseMemoCallback(
	node: ESTree.Node,
	memoIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
): boolean {
	let current: ESTree.Node | null = node.parent;

	while (current !== null) {
		if (isCallbackFunction(current)) {
			const { parent } = current;
			if (isCallExpression(parent) && parent.arguments[0] === current) {
				if (!isUseMemoCall(parent, memoIdentifiers, reactNamespaces)) {
					current = parent.parent;
					continue;
				}

				return true;
			}
		}

		current = current.parent;
	}

	return false;
}

function resolveVariableToFunctionIds(
	variable: ScopeVariable,
	sourceCode: SourceCode,
	functionInfosByNode: ReadonlyMap<CallbackFunction, FunctionInfo>,
	cache: Map<ScopeVariable, ReadonlySet<number>>,
	visited: Set<ScopeVariable>,
): ReadonlySet<number> {
	const cached = cache.get(variable);
	if (cached !== undefined) return cached;

	if (visited.has(variable)) return new Set<number>();
	visited.add(variable);

	const functionIds = new Set<number>();

	for (const definition of variable.defs) {
		const resolved = resolveDefinitionToFunctionIds(definition, sourceCode, functionInfosByNode, cache, visited);
		for (const id of resolved) functionIds.add(id);
	}

	visited.delete(variable);
	cache.set(variable, functionIds);
	return functionIds;
}

function resolveDefinitionToFunctionIds(
	definition: ScopeVariable["defs"][number],
	sourceCode: SourceCode,
	functionInfosByNode: ReadonlyMap<CallbackFunction, FunctionInfo>,
	cache: Map<ScopeVariable, ReadonlySet<number>>,
	visited: Set<ScopeVariable>,
): ReadonlySet<number> {
	if (definition.type === "FunctionName") return resolveFunctionNameDefinition(definition, functionInfosByNode);
	if (definition.type !== "Variable") return new Set<number>();

	const { node } = definition;
	if (node.type !== "VariableDeclarator" || node.init === null) return new Set<number>();

	const initializer = unwrapExpression(node.init);
	if (isCallbackFunction(initializer)) return getFunctionIdSet(initializer, functionInfosByNode);
	if (initializer.type !== "Identifier") return new Set<number>();

	const aliasVariable = getVariableByName(sourceCode.getScope(initializer), initializer.name);
	if (aliasVariable === undefined) return new Set<number>();
	return resolveVariableToFunctionIds(aliasVariable, sourceCode, functionInfosByNode, cache, visited);
}

function resolveFunctionNameDefinition(
	definition: ScopeVariable["defs"][number],
	functionInfosByNode: ReadonlyMap<CallbackFunction, FunctionInfo>,
): ReadonlySet<number> {
	const { node } = definition;
	/* v8 ignore next -- @preserve FunctionName definitions are backed by function declarations in parser scopes. */
	if (node.type !== "FunctionDeclaration") return new Set<number>();
	return getFunctionIdSet(node, functionInfosByNode);
}

function getFunctionIdSet(
	node: CallbackFunction,
	functionInfosByNode: ReadonlyMap<CallbackFunction, FunctionInfo>,
): ReadonlySet<number> {
	const functionId = functionInfosByNode.get(node)?.id;
	/* v8 ignore next -- @preserve callback/function nodes are registered before Program:exit resolution. */
	return functionId === undefined ? new Set<number>() : new Set([functionId]);
}

function resolveIdentifierToFunctionIds(
	identifier: ESTree.IdentifierReference,
	sourceCode: SourceCode,
	functionInfosByNode: ReadonlyMap<CallbackFunction, FunctionInfo>,
	cache: Map<ScopeVariable, ReadonlySet<number>>,
): ReadonlySet<number> {
	const variable = getVariableByName(sourceCode.getScope(identifier), identifier.name);
	if (variable === undefined) return new Set<number>();

	return resolveVariableToFunctionIds(variable, sourceCode, functionInfosByNode, cache, new Set<ScopeVariable>());
}

function populateCallGraph(
	sourceCode: SourceCode,
	functionInfosById: ReadonlyMap<number, FunctionInfo>,
	functionInfosByNode: ReadonlyMap<CallbackFunction, FunctionInfo>,
	variableResolutionCache: Map<ScopeVariable, ReadonlySet<number>>,
): void {
	for (const functionInfo of functionInfosById.values()) {
		for (const identifier of functionInfo.callIdentifiers) {
			const resolvedFunctionIds = resolveIdentifierToFunctionIds(
				identifier,
				sourceCode,
				functionInfosByNode,
				variableResolutionCache,
			);

			for (const id of resolvedFunctionIds) functionInfo.callees.add(id);
		}
	}
}

function collectReachableFunctions(
	rootFunctionIds: ReadonlySet<number>,
	functionInfosById: ReadonlyMap<number, FunctionInfo>,
	maxHelperTraceDepth: number,
): ReadonlySet<number> {
	const visited = new Set<number>(rootFunctionIds);
	const queue = new Array<TraversalState>();
	for (const functionId of rootFunctionIds) queue.push({ depth: 0, functionId });

	let queueIndex = 0;

	while (queueIndex < queue.length) {
		const current = queue[queueIndex];
		queueIndex += 1;
		/* v8 ignore next -- @preserve queueIndex is bounded by queue.length. */
		if (current === undefined || current.depth >= maxHelperTraceDepth) continue;

		const functionInfo = functionInfosById.get(current.functionId);
		/* v8 ignore next -- @preserve reachable IDs are collected from known FunctionInfo entries. */
		if (functionInfo === undefined) continue;

		for (const calleeId of functionInfo.callees) {
			/* v8 ignore next -- @preserve function graph edges are visited once before enqueueing. */
			if (visited.has(calleeId)) continue;
			visited.add(calleeId);
			queue.push({ depth: current.depth + 1, functionId: calleeId });
		}
	}

	return visited;
}

function collectRootFunctionIds(
	sourceCode: SourceCode,
	useMemoInlineCallbacks: ReadonlyArray<CallbackFunction>,
	useMemoCallbackIdentifiers: ReadonlyArray<ESTree.IdentifierReference>,
	functionInfosByNode: ReadonlyMap<CallbackFunction, FunctionInfo>,
	variableResolutionCache: Map<ScopeVariable, ReadonlySet<number>>,
): ReadonlySet<number> {
	const rootFunctionIds = new Set<number>();

	for (const callback of useMemoInlineCallbacks) {
		const functionId = functionInfosByNode.get(callback)?.id;
		/* v8 ignore next -- @preserve inline callbacks are registered in functionInfosByNode before collection. */
		if (functionId !== undefined) rootFunctionIds.add(functionId);
	}

	for (const callbackIdentifier of useMemoCallbackIdentifiers) {
		const resolvedFunctionIds = resolveIdentifierToFunctionIds(
			callbackIdentifier,
			sourceCode,
			functionInfosByNode,
			variableResolutionCache,
		);
		for (const id of resolvedFunctionIds) rootFunctionIds.add(id);
	}

	return rootFunctionIds;
}

const noNewInstanceInUseMemo = defineRule({
	create(context): Visitor {
		const options = normalizeOptions(context.options[0]);
		if (options.constructors.size === 0) return {};

		const reactSources = getReactSources(options.environment);
		const memoIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();
		const functionInfosByNode = new Map<CallbackFunction, FunctionInfo>();
		const functionInfosById = new Map<number, FunctionInfo>();
		const functionStack = new Array<number>();
		const trackedNewExpressions = new Array<TrackedNewExpression>();
		const useMemoCallbackIdentifiers = new Array<ESTree.IdentifierReference>();
		const useMemoInlineCallbacks = new Array<CallbackFunction>();
		const variableResolutionCache = new Map<ScopeVariable, ReadonlySet<number>>();
		let functionCounter = 0;

		function getOrCreateFunctionInfo(node: CallbackFunction): FunctionInfo {
			const existing = functionInfosByNode.get(node);
			/* v8 ignore next -- @preserve function visitor enter creates each FunctionInfo once per AST node. */
			if (existing !== undefined) return existing;

			const created: FunctionInfo = {
				callIdentifiers: [],
				callees: new Set<number>(),
				id: functionCounter,
			};

			functionCounter += 1;
			functionInfosByNode.set(node, created);
			functionInfosById.set(created.id, created);
			return created;
		}

		function recordFunctionCall(identifier: ESTree.IdentifierReference): void {
			const currentFunctionId = functionStack.at(-1);
			if (currentFunctionId === undefined) return;

			const functionInfo = functionInfosById.get(currentFunctionId);
			/* v8 ignore next -- @preserve functionStack stores IDs created in functionInfosById. */
			if (functionInfo === undefined) return;

			functionInfo.callIdentifiers.push(identifier);
		}

		function enterFunction(node: CallbackFunction): void {
			functionStack.push(getOrCreateFunctionInfo(node).id);
		}

		function exitFunction(): void {
			functionStack.pop();
		}

		return {
			ArrowFunctionExpression: enterFunction,
			"ArrowFunctionExpression:exit": exitFunction,

			CallExpression(node): void {
				if (node.callee.type === "Identifier") recordFunctionCall(node.callee);

				if (!isUseMemoCall(node, memoIdentifiers, reactNamespaces)) return;

				const [callback] = node.arguments;
				if (callback === undefined) return;

				if (callback.type === "Identifier") {
					useMemoCallbackIdentifiers.push(callback);
					return;
				}

				if (isCallbackFunction(callback)) useMemoInlineCallbacks.push(callback);
			},

			FunctionDeclaration: enterFunction,
			"FunctionDeclaration:exit": exitFunction,

			FunctionExpression: enterFunction,
			"FunctionExpression:exit": exitFunction,

			ImportDeclaration(node): void {
				trackUseMemoImports(node, reactSources, memoIdentifiers, reactNamespaces);
			},

			NewExpression(node): void {
				if (node.callee.type !== "Identifier") return;

				const constructorName = node.callee.name;
				if (!options.constructors.has(constructorName)) return;

				trackedNewExpressions.push({
					constructorName,
					containingFunctionId: functionStack.at(-1),
					isLexicallyInsideUseMemo: isInsideUseMemoCallback(node, memoIdentifiers, reactNamespaces),
					node,
				});
			},

			"Program:exit"(): void {
				populateCallGraph(context.sourceCode, functionInfosById, functionInfosByNode, variableResolutionCache);
				const rootFunctionIds = collectRootFunctionIds(
					context.sourceCode,
					useMemoInlineCallbacks,
					useMemoCallbackIdentifiers,
					functionInfosByNode,
					variableResolutionCache,
				);
				const reachableFunctionIds = collectReachableFunctions(
					rootFunctionIds,
					functionInfosById,
					options.maxHelperTraceDepth,
				);

				for (const trackedNewExpression of trackedNewExpressions) {
					const matchesHelperTrace =
						trackedNewExpression.containingFunctionId !== undefined &&
						reachableFunctionIds.has(trackedNewExpression.containingFunctionId);

					if (!(trackedNewExpression.isLexicallyInsideUseMemo || matchesHelperTrace)) continue;

					context.report({
						data: { constructorName: trackedNewExpression.constructorName },
						messageId: "noNewInUseMemo",
						node: trackedNewExpression.node,
					});
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow configured constructor calls (default: new Instance) inside React useMemo callbacks.",
		},
		messages: {
			noNewInUseMemo:
				"Avoid creating '{{constructorName}}' with `new` inside useMemo. Create it outside the memo callback or use an effect/ref pattern.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					constructors: {
						description: "Constructor identifiers that should be disallowed inside useMemo callbacks.",
						items: { type: "string" },
						type: "array",
					},
					environment: {
						default: "roblox-ts",
						description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
					maxHelperTraceDepth: {
						default: 4,
						description:
							"Maximum depth for tracing local helper function calls from useMemo callbacks. 0 disables helper traversal.",
						minimum: 0,
						type: "integer",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noNewInstanceInUseMemo;
