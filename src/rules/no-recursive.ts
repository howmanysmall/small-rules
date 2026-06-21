import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Scope, Visitor } from "oxlint-plugin-utilities";

interface CallSite {
	readonly callee: string;
	readonly caller: string;
	readonly node: ESTree.CallExpression;
}

function isResolvedInScope(name: string, scope: Scope): boolean {
	let currentScope: Scope | null = scope;
	while (currentScope) {
		if (currentScope.set.has(name)) return true;
		currentScope = currentScope.upper;
	}
	return false;
}

// Find all nodes in cycles using DFS with coloring
function findCycleParticipants(callGraph: Map<string, Set<string>>): ReadonlySet<string> {
	const WHITE = 0;
	const GRAY = 1;
	const BLACK = 2;
	const color = new Map<string, number>();
	const inCycle = new Set<string>();

	for (const name of callGraph.keys()) color.set(name, WHITE);

	function dfs(node: string, path: Array<string>): void {
		color.set(node, GRAY);
		path.push(node);

		for (const neighbor of callGraph.get(node) ?? []) {
			const neighborColor = color.get(neighbor);
			if (neighborColor === GRAY) {
				// Back edge found — all nodes from neighbor to current node form a cycle
				const cycleStart = path.lastIndexOf(neighbor);
				for (let index = cycleStart; index < path.length; index += 1) {
					const cycleNode = path[index];
					if (cycleNode !== undefined) inCycle.add(cycleNode);
				}
			} else if (neighborColor === WHITE) dfs(neighbor, path);
		}

		path.pop();
		color.set(node, BLACK);
	}

	for (const name of callGraph.keys()) if (color.get(name) === WHITE) dfs(name, []);

	return inCycle;
}

const noRecursive = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;

		// Call graph adjacency: caller → set of callees
		const callGraph = new Map<string, Set<string>>();
		// Stack of function names we're currently visiting
		const functionStack: Array<string | undefined> = [];
		// All call sites that might involve local functions
		const callSites: Array<CallSite> = [];

		// Class tracking for this.method() detection
		const classStack: Array<string | undefined> = [];
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
			if (!callGraph.has(name)) {
				callGraph.set(name, new Set());
			}
		}

		function findEnclosingClassName(): string | undefined {
			for (let index = classStack.length - 1; index >= 0; index -= 1) {
				if (classStack[index] !== undefined) return classStack[index];
			}
			return undefined;
		}

		return {
			ArrowFunctionExpression(): void {
				pushFunction(undefined);
			},
			"ArrowFunctionExpression:exit"(): void {
				popFunction();
			},

			// ---- Call expression analysis ----

			CallExpression(node): void {
				const caller = getEnclosingFunctionName();
				// Not inside a tracked function
				if (caller === undefined) return;

				let calleeName: string | undefined;
				let isThisMethodCall = false;

				if (node.callee.type === "Identifier") {
					calleeName = node.callee.name;
				} else if (
					node.callee.type === "MemberExpression" &&
					node.callee.object.type === "ThisExpression" &&
					node.callee.property.type === "Identifier"
				) {
					calleeName = node.callee.property.name;
					isThisMethodCall = true;
				}

				if (calleeName === undefined) return;

				let isLocal = false;

				if (isThisMethodCall) {
					const className = findEnclosingClassName();
					if (className !== undefined) {
						const methods = classMethods.get(className);
						if (methods?.has(calleeName) === true) {
							isLocal = true;
						}
					}
				} else {
					const scope = sourceCode.getScope(node);
					isLocal = isResolvedInScope(calleeName, scope);
				}

				if (isLocal) {
					callGraph.get(caller)?.add(calleeName);
					callSites.push({ callee: calleeName, caller, node });
				}
			},

			// ---- Class tracking ----

			ClassDeclaration(node): void {
				const className = node.id?.name;
				if (className !== undefined && !classMethods.has(className)) {
					classMethods.set(className, new Set());
				}
				classStack.push(className);
			},
			"ClassDeclaration:exit"(): void {
				classStack.pop();
			},

			// ---- Enter/exit function scopes ----

			FunctionDeclaration(node): void {
				const name = node.id?.name;
				if (name !== undefined && name !== "") {
					registerFunction(name);
				}
				pushFunction(name);
			},
			"FunctionDeclaration:exit"(): void {
				popFunction();
			},

			FunctionExpression(node): void {
				// Named function expressions
				if (node.id) {
					registerFunction(node.id.name);
				}
				// Check if this is a method body — the parent might be a MethodDefinition
				const { parent } = node;
				if (parent?.type === "MethodDefinition" && parent.key.type === "Identifier") {
					pushFunction(parent.key.name);
				} else {
					pushFunction(undefined);
				}
			},
			"FunctionExpression:exit"(): void {
				popFunction();
			},

			MethodDefinition(node): void {
				const className = findEnclosingClassName();
				if (node.key.type === "Identifier" && className !== undefined) {
					const methods = classMethods.get(className);
					if (methods) {
						methods.add(node.key.name);
					}
					registerFunction(node.key.name);
				}
			},

			// ---- Post-traversal analysis ----

			"Program:exit"(): void {
				const inCycle = findCycleParticipants(callGraph);
				if (inCycle.size === 0) return;

				for (const callSite of callSites) {
					if (inCycle.has(callSite.caller) && inCycle.has(callSite.callee)) {
						context.report({
							messageId: "noRecursive",
							node: callSite.node,
						});
					}
				}
			},

			// ---- Variable assignments (const foo = () => ...) ----

			VariableDeclarator(node): void {
				if (
					!(
						node.id.type === "Identifier" &&
						node.init !== null &&
						(node.init.type === "FunctionExpression" || node.init.type === "ArrowFunctionExpression")
					)
				) {
					return;
				}
				registerFunction(node.id.name);
				pushFunction(node.id.name);
			},
			"VariableDeclarator:exit"(node): void {
				if (
					!(
						node.id.type === "Identifier" &&
						node.init !== null &&
						(node.init.type === "FunctionExpression" || node.init.type === "ArrowFunctionExpression")
					)
				) {
					return;
				}
				popFunction();
			},
		};
	},
	meta: {
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
