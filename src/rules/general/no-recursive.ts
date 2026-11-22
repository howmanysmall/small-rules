import {
	isBindingIdentifier,
	isCallbackFunction,
	isIdentifier,
	isMemberExpression,
	isMethodDefinition,
	isThisExpression,
} from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Scope, Variable, Visitor } from "oxlint-plugin-utilities";

interface CallSite {
	readonly callee: string;
	readonly caller: string;
	readonly node: ESTree.CallExpression;
}

/**
 * Whether a binding can only be something from outside this file's functions:
 * an import or a parameter. Calling one is never a call back into the
 * function or method that happens to share its name.
 *
 * @param variable - The binding a bare call resolves to.
 * @returns `true` when every definition is an import or a parameter.
 */
function isImportOrParameter({ defs }: Variable): boolean {
	return defs.length > 0 && defs.every(({ type }) => type === "ImportBinding" || type === "Parameter");
}

function isResolvedInScope(name: string, scope: Scope): boolean {
	let currentScope: null | Scope = scope;
	while (currentScope) {
		const variable = currentScope.set.get(name);
		if (variable !== undefined) return !isImportOrParameter(variable);
		currentScope = currentScope.upper;
	}

	return false;
}

const enum Color {
	White = 0,
	Gray = 1,
	Black = 2,
}

function markCycleParticipants(path: Array<string>, neighbor: string, inCycle: Set<string>): void {
	const cycleStart = path.lastIndexOf(neighbor);
	for (let index = cycleStart; index < path.length; index += 1) {
		const cycleNode = path[index];
		/* v8 ignore next -- cycleStart is found from an existing path entry. @preserve */
		if (cycleNode !== undefined) {
			inCycle.add(cycleNode);
		}
	}
}

/** A function on the search path, with the callees still to visit. */
interface SearchFrame {
	readonly name: string;
	readonly callees: Iterator<string>;
}

function findCycleParticipants(callGraph: Map<string, Set<string>>): ReadonlySet<string> {
	const color = new Map<string, Color>();
	const inCycle = new Set<string>();

	for (const name of callGraph.keys()) {
		color.set(name, Color.White);
	}

	/**
	 * Marks a function as on the search path and opens its callees.
	 *
	 * @param name - The function the search enters.
	 * @param path - The functions on the search path.
	 * @returns The frame that visits the callees of the function.
	 */
	function enterFunction(name: string, path: Array<string>): SearchFrame {
		color.set(name, Color.Gray);
		path.push(name);

		/* v8 ignore next -- registered call graph nodes always have an adjacency set. @preserve */
		const graph = callGraph.get(name) ?? [];
		return { name, callees: graph[Symbol.iterator]() };
	}

	for (const name of callGraph.keys()) {
		if (color.get(name) !== Color.White) continue;

		const path = new Array<string>();
		const frames = new Array<SearchFrame>();
		let frame: SearchFrame | undefined = enterFunction(name, path);
		while (frame !== undefined) {
			const step = frame.callees.next();
			if (step.done === true) {
				path.pop();
				color.set(frame.name, Color.Black);
				frame = frames.pop();
				continue;
			}

			const neighbor = step.value;
			const neighborColor = color.get(neighbor);
			if (neighborColor === Color.Gray) {
				markCycleParticipants(path, neighbor, inCycle);
			} else if (neighborColor === Color.White) {
				frames.push(frame);
				frame = enterFunction(neighbor, path);
			}
		}
	}

	return inCycle;
}

/**
 * Names the graph node of a method after its class, so that methods of
 * different classes that share a name stay apart.
 *
 * @param className - The class that declares the method.
 * @param methodName - The name the method is declared with.
 * @returns The key that names the method in the call graph.
 */
function getMethodNodeKey(className: string, methodName: string): string {
	return `${className}.${methodName}`;
}

/** The class and the name behind a method node key. */
interface MethodInfo {
	readonly className: string;
	readonly methodName: string;
}

/**
 * Finds the method that a method of a class is the override of, all the way
 * up the `extends` chain, so that an override and what it overrides share one
 * node.
 *
 * @param method - The method to start from.
 * @param methodNames - Every method node key, with its class and name.
 * @param parentClasses - The parent class name of every class that has one.
 * @returns The node key of the furthest ancestor method declared in this file
 *   with the same name, or the key of the method itself without one.
 */
function findOverriddenMethodKey(
	{ className, methodName }: MethodInfo,
	methodNames: ReadonlyMap<string, MethodInfo>,
	parentClasses: ReadonlyMap<string, string>,
): string {
	const visited = new Set([className]);
	let topKey = getMethodNodeKey(className, methodName);
	let ancestor = parentClasses.get(className);
	while (ancestor !== undefined && !visited.has(ancestor)) {
		visited.add(ancestor);
		const ancestorKey = getMethodNodeKey(ancestor, methodName);
		if (methodNames.has(ancestorKey)) {
			topKey = ancestorKey;
		}

		ancestor = parentClasses.get(ancestor);
	}

	return topKey;
}

/**
 * Builds the lookup that decides which node a graph key stands for. A method
 * shares its node with a plain function or binding of the same name, as it
 * always has. Without one, it shares its node with the method it overrides
 * in an ancestor class, and otherwise it is a node of its own.
 *
 * @param callGraph - The call graph built while visiting.
 * @param methodNames - Every method node key, with its class and name.
 * @param parentClasses - The parent class name of every class that has one.
 * @param callSites - The calls recorded while visiting.
 * @returns A function that maps a graph key to its node.
 */
function createNodeResolver(
	callGraph: ReadonlyMap<string, unknown>,
	methodNames: ReadonlyMap<string, MethodInfo>,
	parentClasses: ReadonlyMap<string, string>,
	callSites: ReadonlyArray<CallSite>,
): (key: string) => string {
	const plainNames = new Set<string>();
	for (const key of callGraph.keys()) {
		if (!methodNames.has(key)) {
			plainNames.add(key);
		}
	}

	for (const { callee } of callSites) {
		if (!methodNames.has(callee)) {
			plainNames.add(callee);
		}
	}

	return (key) => {
		const method = methodNames.get(key);
		if (method === undefined) return key;
		if (plainNames.has(method.methodName)) return method.methodName;
		return findOverriddenMethodKey(method, methodNames, parentClasses);
	};
}

/**
 * Copies a call graph onto its nodes, joining the keys that share a node.
 *
 * @param callGraph - The call graph built while visiting.
 * @param resolveNode - Maps a graph key to its node.
 * @returns A new call graph keyed by node.
 */
function mergeSharedNodes(
	callGraph: ReadonlyMap<string, ReadonlySet<string>>,
	resolveNode: (key: string) => string,
): Map<string, Set<string>> {
	const merged = new Map<string, Set<string>>();
	for (const [key, callees] of callGraph) {
		const node = resolveNode(key);
		let nodeCallees = merged.get(node);
		if (nodeCallees === undefined) {
			nodeCallees = new Set();
			merged.set(node, nodeCallees);
		}

		for (const callee of callees) {
			nodeCallees.add(resolveNode(callee));
		}
	}

	return merged;
}

/**
 * Copies a call graph and adds the edges of the deferred `this` calls.
 *
 * @param callGraph - The call graph, keyed by node.
 * @param deferredCallSites - `this` calls resolved when their class closed.
 * @param resolveNode - Maps a graph key to its node.
 * @returns A new call graph that holds both kinds of edges.
 */
function addDeferredEdges(
	callGraph: ReadonlyMap<string, ReadonlySet<string>>,
	deferredCallSites: ReadonlyArray<CallSite>,
	resolveNode: (key: string) => string,
): Map<string, Set<string>> {
	const merged = new Map<string, Set<string>>();
	for (const [name, callees] of callGraph) {
		merged.set(name, new Set(callees));
	}

	for (const { callee, caller } of deferredCallSites) {
		merged.get(resolveNode(caller))?.add(resolveNode(callee));
	}

	return merged;
}

function getDirectCalleeName(callee: ESTree.Expression): string | undefined {
	return isBindingIdentifier(callee) ? callee.name : undefined;
}

function getThisMethodCalleeName(callee: ESTree.Expression): string | undefined {
	if (!isMemberExpression(callee) || !isThisExpression(callee.object) || !isBindingIdentifier(callee.property)) {
		return undefined;
	}

	return callee.property.name;
}

interface ResolvedCallee {
	readonly calleeName: string;
	readonly isThisMethodCall: boolean;
}

function resolveCallee(node: ESTree.CallExpression): ResolvedCallee | undefined {
	const direct = getDirectCalleeName(node.callee);
	if (direct !== undefined) {
		return { calleeName: direct, isThisMethodCall: false };
	}

	const method = getThisMethodCalleeName(node.callee);
	if (method !== undefined) {
		return { calleeName: method, isThisMethodCall: true };
	}

	return undefined;
}

const noRecursive = createRule("no-recursive", "general", {
	create(context): Visitor {
		const { sourceCode } = context;

		const callGraph = new Map<string, Set<string>>();
		const functionStack = new Array<string | undefined>();
		const callSites = new Array<CallSite>();

		const classStack = new Array<string | undefined>();
		// The class and method name behind each method node key.
		const methodNames = new Map<string, MethodInfo>();
		// The parent class name of each class that extends a plain identifier.
		const parentClasses = new Map<string, string>();
		// `this.x()` calls whose method was not declared yet, keyed by class.
		const pendingThisCalls = new Map<string, Array<CallSite>>();
		const deferredCallSites = new Array<CallSite>();

		function pushFunction(name?: string): void {
			functionStack.push(name);
		}

		function popFunction(): void {
			functionStack.pop();
		}

		function getEnclosingFunctionName(): string | undefined {
			for (let index = functionStack.length - 1; index >= 0; index -= 1) {
				const name = functionStack[index];
				if (name !== undefined) return name;
			}

			return undefined;
		}

		function registerFunction(name: string): void {
			if (!callGraph.has(name)) {
				callGraph.set(name, new Set());
			}
		}

		function findEnclosingClassName(): string | undefined {
			for (let index = classStack.length - 1; index >= 0; index -= 1) {
				/* v8 ignore next -- class stack entries are parser-managed and only named classes can resolve this-method cycles. @preserve */
				if (classStack[index] !== undefined) return classStack[index];
			}

			return undefined;
		}

		/**
		 * Gives the node key of a method declared where the visitor stands.
		 *
		 * @param methodName - The name the method is declared with.
		 * @returns The method node key, or the bare name outside a named class.
		 */
		function getMethodCallerKey(methodName: string): string {
			const className = findEnclosingClassName();
			return className === undefined ? methodName : getMethodNodeKey(className, methodName);
		}

		function recordLocalCall(caller: string, calleeName: string, node: ESTree.CallExpression): void {
			callGraph.get(caller)?.add(calleeName);
			callSites.push({ callee: calleeName, caller, node });
		}

		/**
		 * Records a `this` call, or holds it back until its class has been fully
		 * visited when the method is not declared yet.
		 *
		 * @param caller - The enclosing function node key.
		 * @param calleeName - The called method name.
		 * @param node - The call expression.
		 */
		function recordThisCall(caller: string, calleeName: string, node: ESTree.CallExpression): void {
			const className = findEnclosingClassName();
			if (className === undefined) return;

			const callSite = { callee: getMethodNodeKey(className, calleeName), caller, node };
			if (methodNames.has(callSite.callee)) {
				recordLocalCall(caller, callSite.callee, node);
				return;
			}

			const pending = pendingThisCalls.get(className);
			if (pending === undefined) {
				pendingThisCalls.set(className, [callSite]);
			} else {
				pending.push(callSite);
			}
		}

		/** Resolves the held `this` calls of the class that is closing. */
		function resolveDeferredThisCalls(): void {
			const className = classStack.at(-1);
			if (className === undefined) return;

			const pending = pendingThisCalls.get(className);
			if (pending === undefined) return;

			pendingThisCalls.delete(className);

			for (const callSite of pending) {
				if (methodNames.has(callSite.callee)) {
					deferredCallSites.push(callSite);
				}
			}
		}

		return {
			ArrowFunctionExpression(): void {
				pushFunction(undefined);
			},
			"ArrowFunctionExpression:exit": popFunction,
			CallExpression(node): void {
				const caller = getEnclosingFunctionName();
				if (caller === undefined) return;

				const resolved = resolveCallee(node);
				if (resolved === undefined) return;

				const { calleeName, isThisMethodCall } = resolved;
				if (isThisMethodCall) {
					recordThisCall(caller, calleeName, node);
				} else if (isResolvedInScope(calleeName, sourceCode.getScope(node))) {
					recordLocalCall(caller, calleeName, node);
				}
			},

			ClassDeclaration(node): void {
				classStack.push(node.id?.name);

				if (node.id !== null && isIdentifier(node.superClass)) {
					parentClasses.set(node.id.name, node.superClass.name);
				}
			},
			"ClassDeclaration:exit"(): void {
				resolveDeferredThisCalls();
				classStack.pop();
			},

			FunctionDeclaration(node): void {
				const name = node.id?.name;
				/* v8 ignore next -- FunctionDeclaration visitors have non-empty identifiers in supported parser output. @preserve */
				if (name !== undefined && name.length > 0) {
					registerFunction(name);
				}

				pushFunction(name);
			},
			"FunctionDeclaration:exit": popFunction,
			FunctionExpression(node): void {
				if (node.id) {
					registerFunction(node.id.name);
				}

				const { parent } = node;
				if (isMethodDefinition(parent) && isBindingIdentifier(parent.key)) {
					pushFunction(getMethodCallerKey(parent.key.name));
				} else {
					pushFunction(undefined);
				}
			},
			"FunctionExpression:exit": popFunction,

			MethodDefinition(node): void {
				const className = findEnclosingClassName();
				if (className !== undefined && isBindingIdentifier(node.key)) {
					const methodKey = getMethodNodeKey(className, node.key.name);
					methodNames.set(methodKey, { className, methodName: node.key.name });
					registerFunction(methodKey);
				}
			},

			"Program:exit"(): void {
				const resolveNode = createNodeResolver(callGraph, methodNames, parentClasses, callSites);
				const nodeGraph = mergeSharedNodes(callGraph, resolveNode);
				const inCycle = findCycleParticipants(nodeGraph);
				// The search marks one cycle per back edge, so extra edges can
				// change what it marks. Keep every node the first graph marks.
				const participants =
					deferredCallSites.length === 0
						? inCycle
						: new Set([
								...inCycle,
								...findCycleParticipants(addDeferredEdges(nodeGraph, deferredCallSites, resolveNode)),
							]);

				if (participants.size === 0) return;

				for (const sites of [callSites, deferredCallSites]) {
					for (const callSite of sites) {
						const { callee, caller } = callSite;
						/* v8 ignore next -- call sites are recorded only from graph edges between registered participants. @preserve */
						if (participants.has(resolveNode(caller)) && participants.has(resolveNode(callee))) {
							context.report({
								messageId: "noRecursive",
								node: callSite.node,
							});
						}
					}
				}
			},

			VariableDeclarator(node): void {
				if (!isBindingIdentifier(node.id) || !isCallbackFunction(node.init)) return;
				registerFunction(node.id.name);
				pushFunction(node.id.name);
			},
			"VariableDeclarator:exit"(node): void {
				if (!isBindingIdentifier(node.id) || !isCallbackFunction(node.init)) return;
				popFunction();
			},
		};
	},
	meta: {
		docs: {
			description: "Disallow recursive function calls to prevent stack overflow.",
		},
		messages: {
			noRecursive:
				"Recursion is not allowed (JPL Power of 10). Use iteration instead — a loop or explicit stack.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {},
				type: "object",
			},
		],
	},
});

export default noRecursive;
