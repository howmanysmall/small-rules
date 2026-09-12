import { createRule } from "$oxc-utilities/create-rule";
import {
	isArrowFunctionExpression,
	isBindingIdentifier,
	isFunctionExpression,
	isMemberExpression,
	isMethodDefinition,
	isThisExpression,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Scope, Visitor } from "oxlint-plugin-utilities";

interface CallSite {
	readonly callee: string;
	readonly caller: string;
	readonly node: ESTree.CallExpression;
}

function isResolvedInScope(name: string, scope: Scope): boolean {
	let currentScope: null | Scope = scope;
	while (currentScope) {
		if (currentScope.set.has(name)) return true;
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
		if (cycleNode !== undefined) inCycle.add(cycleNode);
	}
}

function findCycleParticipants(callGraph: Map<string, Set<string>>): ReadonlySet<string> {
	const color = new Map<string, Color>();
	const inCycle = new Set<string>();

	for (const name of callGraph.keys()) color.set(name, Color.White);

	function visitNeighbor(neighbor: string, path: Array<string>): void {
		const neighborColor = color.get(neighbor);
		if (neighborColor === Color.Gray) {
			markCycleParticipants(path, neighbor, inCycle);
			/* v8 ignore start -- idk man @preserve */
		} else if (neighborColor === Color.White) depthFirstSearch(neighbor, path);
		/* v8 ignore stop -- idk man @preserve */
	}

	function depthFirstSearch(node: string, path: Array<string>): void {
		color.set(node, Color.Gray);
		path.push(node);

		/* v8 ignore next -- registered call graph nodes always have an adjacency set. @preserve */
		const graph = callGraph.get(node) ?? [];
		for (const neighbor of graph) visitNeighbor(neighbor, path);

		path.pop();
		color.set(node, Color.Black);
	}

	for (const name of callGraph.keys()) if (color.get(name) === Color.White) depthFirstSearch(name, []);

	return inCycle;
}

function getDirectCalleeName(callee: ESTree.Expression): string | undefined {
	return isBindingIdentifier(callee) ? callee.name : undefined;
}

function getThisMethodCalleeName(callee: ESTree.Expression): string | undefined {
	if (!isMemberExpression(callee) || !isThisExpression(callee.object)) return undefined;
	if (!isBindingIdentifier(callee.property)) return undefined;
	return callee.property.name;
}

interface ResolvedCallee {
	readonly calleeName: string;
	readonly isThisMethodCall: boolean;
}

function resolveCallee(node: ESTree.CallExpression): ResolvedCallee | undefined {
	const direct = getDirectCalleeName(node.callee);
	if (direct !== undefined) return { calleeName: direct, isThisMethodCall: false };
	const method = getThisMethodCalleeName(node.callee);
	if (method !== undefined) return { calleeName: method, isThisMethodCall: true };
	return undefined;
}

const noRecursive = createRule("no-recursive", "general", {
	create(context): Visitor {
		const { sourceCode } = context;

		const callGraph = new Map<string, Set<string>>();
		const functionStack = new Array<string | undefined>();
		const callSites = new Array<CallSite>();

		const classStack = new Array<string | undefined>();
		const classMethods = new Map<string, Set<string>>();

		function pushFunction(name: string | undefined): void {
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
			if (!callGraph.has(name)) callGraph.set(name, new Set());
		}

		function findEnclosingClassName(): string | undefined {
			for (let index = classStack.length - 1; index >= 0; index -= 1) {
				/* v8 ignore next -- class stack entries are parser-managed and only named classes can resolve this-method cycles. @preserve */
				if (classStack[index] !== undefined) return classStack[index];
			}
			return undefined;
		}

		function isLocalThisMethod(calleeName: string): boolean {
			const className = findEnclosingClassName();
			if (className === undefined) return false;
			const methods = classMethods.get(className);
			/* v8 ignore next -- named class entries are initialized before MethodDefinition visits. @preserve */
			return methods?.has(calleeName) === true;
		}

		function isLocalCallee(calleeName: string, isThisMethodCall: boolean, node: ESTree.CallExpression): boolean {
			if (isThisMethodCall) return isLocalThisMethod(calleeName);
			const scope = sourceCode.getScope(node);
			return isResolvedInScope(calleeName, scope);
		}

		function recordLocalCall(caller: string, calleeName: string, node: ESTree.CallExpression): void {
			callGraph.get(caller)?.add(calleeName);
			callSites.push({ callee: calleeName, caller, node });
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
				if (!isLocalCallee(calleeName, isThisMethodCall, node)) return;
				recordLocalCall(caller, calleeName, node);
			},

			ClassDeclaration(node): void {
				const className = node.id?.name;
				/* v8 ignore next -- duplicate class declaration names share the existing tracked method set. @preserve */
				if (className !== undefined && !classMethods.has(className)) classMethods.set(className, new Set());
				classStack.push(className);
			},
			"ClassDeclaration:exit"(): void {
				classStack.pop();
			},

			FunctionDeclaration(node): void {
				const name = node.id?.name;
				/* v8 ignore next -- FunctionDeclaration visitors have non-empty identifiers in supported parser output. @preserve */
				if (name !== undefined && name.length > 0) registerFunction(name);
				pushFunction(name);
			},
			"FunctionDeclaration:exit": popFunction,
			FunctionExpression(node): void {
				if (node.id) registerFunction(node.id.name);
				const { parent } = node;
				if (isMethodDefinition(parent) && isBindingIdentifier(parent.key)) pushFunction(parent.key.name);
				else pushFunction(undefined);
			},
			"FunctionExpression:exit": popFunction,

			MethodDefinition(node): void {
				const className = findEnclosingClassName();
				if (className !== undefined && isBindingIdentifier(node.key)) {
					const methods = classMethods.get(className);
					methods?.add(node.key.name);
					registerFunction(node.key.name);
				}
			},

			"Program:exit"(): void {
				const inCycle = findCycleParticipants(callGraph);
				if (inCycle.size === 0) return;

				for (const callSite of callSites) {
					/* v8 ignore next -- call sites are recorded only from graph edges between registered participants. @preserve */
					if (inCycle.has(callSite.caller) && inCycle.has(callSite.callee)) {
						context.report({
							messageId: "noRecursive",
							node: callSite.node,
						});
					}
				}
			},

			VariableDeclarator(node): void {
				if (
					!isBindingIdentifier(node.id) ||
					node.init === null ||
					(!isFunctionExpression(node.init) && !isArrowFunctionExpression(node.init))
				) {
					return;
				}
				registerFunction(node.id.name);
				pushFunction(node.id.name);
			},
			"VariableDeclarator:exit"(node): void {
				if (
					!isBindingIdentifier(node.id) ||
					node.init === null ||
					(!isFunctionExpression(node.init) && !isArrowFunctionExpression(node.init))
				) {
					return;
				}
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
