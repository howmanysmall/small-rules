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

const enum Color {
	White = 0,
	Gray = 1,
	Black = 2,
}

function findCycleParticipants(callGraph: Map<string, Set<string>>): ReadonlySet<string> {
	const color = new Map<string, Color>();
	const inCycle = new Set<string>();

	for (const name of callGraph.keys()) color.set(name, Color.White);

	function dfs(node: string, path: Array<string>): void {
		color.set(node, Color.Gray);
		path.push(node);

		/* v8 ignore next -- registered call graph nodes always have an adjacency set. @preserve */
		for (const neighbor of callGraph.get(node) ?? []) {
			const neighborColor = color.get(neighbor);
			if (neighborColor === Color.Gray) {
				const cycleStart = path.lastIndexOf(neighbor);
				for (let index = cycleStart; index < path.length; index += 1) {
					const cycleNode = path[index];
					/* v8 ignore next -- cycleStart is found from an existing path entry. @preserve */
					if (cycleNode !== undefined) inCycle.add(cycleNode);
				}
			} else if (neighborColor === Color.White) dfs(neighbor, path);
		}

		path.pop();
		color.set(node, Color.Black);
	}

	for (const name of callGraph.keys()) if (color.get(name) === Color.White) dfs(name, []);

	return inCycle;
}

const noRecursive = defineRule({
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

		return {
			ArrowFunctionExpression(): void {
				pushFunction(undefined);
			},
			"ArrowFunctionExpression:exit": popFunction,
			CallExpression(node): void {
				const caller = getEnclosingFunctionName();
				if (caller === undefined) return;

				let calleeName: string | undefined;
				let isThisMethodCall = false;

				if (node.callee.type === "Identifier") calleeName = node.callee.name;
				else if (
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
						/* v8 ignore next -- named class entries are initialized before MethodDefinition visits. @preserve */
						if (methods?.has(calleeName) === true) isLocal = true;
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
				if (parent?.type === "MethodDefinition" && parent.key.type === "Identifier") {
					pushFunction(parent.key.name);
				} else pushFunction(undefined);
			},
			"FunctionExpression:exit": popFunction,

			MethodDefinition(node): void {
				const className = findEnclosingClassName();
				if (node.key.type === "Identifier" && className !== undefined) {
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
