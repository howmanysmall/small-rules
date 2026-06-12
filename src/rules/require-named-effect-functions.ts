import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { getHookName } from "$oxc-utilities/react-hook-utilities";
import { isEnvironment } from "$oxc-utilities/react-utilities";
import { isRecord } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { Environment } from "$oxc-utilities/react-utilities";
import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

interface HookConfiguration {
	readonly allowAsync: boolean;
	readonly name: string;
}

interface EffectFunctionOptions {
	readonly environment: Environment;
	readonly hooks: ReadonlyArray<HookConfiguration>;
}

const DEFAULT_HOOKS = [
	{ allowAsync: false, name: "useEffect" },
	{ allowAsync: false, name: "useLayoutEffect" },
	{ allowAsync: false, name: "useInsertionEffect" },
] as const;

function isHookConfiguration(value: unknown): value is HookConfiguration {
	return isRecord(value) && typeof value.name === "string" && typeof value.allowAsync === "boolean";
}

function parseOptions(rawOptions: unknown): EffectFunctionOptions {
	if (!isRecord(rawOptions)) return { environment: "roblox-ts", hooks: DEFAULT_HOOKS };

	const environment: Environment = isEnvironment(rawOptions.environment) ? rawOptions.environment : "roblox-ts";

	const rawHooks = rawOptions.hooks;
	if (!Array.isArray(rawHooks)) return { environment, hooks: DEFAULT_HOOKS };

	const hooks = new Array<HookConfiguration>();
	for (const rawHook of rawHooks) if (isHookConfiguration(rawHook)) hooks.push(rawHook);

	if (hooks.length === 0) return { environment, hooks: DEFAULT_HOOKS };
	return { environment, hooks };
}

interface ResolvedFunction {
	readonly isAsync: boolean;
	readonly node: CallbackFunction;
	readonly type: "arrow" | "function-declaration" | "function-expression";
}

function resolveFunctionFromVariable(variable: ScopeVariable): ResolvedFunction | undefined {
	for (const definition of variable.defs) {
		const { node } = definition;
		if (node.type === "FunctionDeclaration") {
			return {
				isAsync: node.async,
				node,
				type: "function-declaration",
			};
		}

		if (node.type === "VariableDeclarator") {
			if (node.init === null) continue;

			if (node.init.type === "ArrowFunctionExpression") {
				return {
					isAsync: node.init.async,
					node: node.init,
					type: "arrow",
				};
			}

			if (node.init.type === "FunctionExpression") {
				return {
					isAsync: node.init.async,
					node: node.init,
					type: "function-expression",
				};
			}
		}
	}

	return undefined;
}

function isCallbackHookResult(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): boolean {
	const scope = sourceCode.getScope(identifier);
	const variable = getVariableByName(scope, identifier.name);
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		const { node } = definition;
		if (node.type !== "VariableDeclarator" || node.init?.type !== "CallExpression") continue;

		const calleeHookName = getHookName(node.init);
		if (calleeHookName === "useCallback" || calleeHookName === "useMemo") return true;
	}

	return false;
}

const requireNamedEffectFunctions = defineRule({
	create(context): Visitor {
		const { environment, hooks } = parseOptions(context.options[0]);
		const hookAsyncConfig = new Map(hooks.map((hookConfig) => [hookConfig.name, hookConfig.allowAsync]));
		const effectHooks = new Set(hookAsyncConfig.keys());
		const isRobloxTsMode = environment === "roblox-ts";

		function isAsyncAllowed(hookName: string): boolean {
			const result = hookAsyncConfig.get(hookName);
			return typeof result === "boolean" ? result : false;
		}

		return {
			CallExpression(node): void {
				const hookName = getHookName(node);
				if (hookName === undefined || !effectHooks.has(hookName)) return;

				const [firstArgument] = node.arguments;
				if (firstArgument === undefined) return;

				if (firstArgument.type === "Identifier") {
					const scope = context.sourceCode.getScope(firstArgument);
					const variable = getVariableByName(scope, firstArgument.name);

					if (variable === undefined) {
						if (isCallbackHookResult(context.sourceCode, firstArgument)) {
							context.report({
								data: { hook: hookName },
								messageId: "identifierReferencesCallback",
								node,
							});
						}
						return;
					}

					const resolved = resolveFunctionFromVariable(variable);

					if (resolved === undefined) {
						if (isCallbackHookResult(context.sourceCode, firstArgument)) {
							context.report({
								data: { hook: hookName },
								messageId: "identifierReferencesCallback",
								node,
							});
						}
						return;
					}

					if (resolved.type === "arrow") {
						if (resolved.isAsync) {
							if (!isAsyncAllowed(hookName)) {
								context.report({
									data: { hook: hookName },
									messageId: "identifierReferencesAsyncArrow",
									node,
								});
							}
						} else {
							context.report({
								data: { hook: hookName },
								messageId: "identifierReferencesArrow",
								node,
							});
						}
					} else if (resolved.type === "function-expression") {
						if (resolved.node.id === null) {
							context.report({
								data: { hook: hookName },
								messageId: "anonymousFunction",
								node,
							});
						} else if (isRobloxTsMode) {
							context.report({
								data: { hook: hookName },
								messageId: "functionExpression",
								node,
							});
						}
					} else if (resolved.isAsync && !isAsyncAllowed(hookName)) {
						context.report({
							data: { hook: hookName },
							messageId: "identifierReferencesAsyncFunction",
							node,
						});
					}
					return;
				}

				if (firstArgument.type === "ArrowFunctionExpression") {
					if (firstArgument.async) {
						context.report({
							data: { hook: hookName },
							messageId: "asyncArrowFunction",
							node,
						});
					} else {
						context.report({
							data: { hook: hookName },
							messageId: "arrowFunction",
							node,
						});
					}
					return;
				}

				if (firstArgument.type === "FunctionExpression") {
					const functionHasId = firstArgument.id !== null;

					if (functionHasId && firstArgument.async) {
						context.report({
							data: { hook: hookName },
							messageId: "asyncFunctionExpression",
							node,
						});
					} else if (functionHasId && isRobloxTsMode) {
						context.report({
							data: { hook: hookName },
							messageId: "functionExpression",
							node,
						});
					} else if (!functionHasId && firstArgument.async) {
						context.report({
							data: { hook: hookName },
							messageId: "asyncAnonymousFunction",
							node,
						});
					} else if (!functionHasId) {
						context.report({
							data: { hook: hookName },
							messageId: "anonymousFunction",
							node,
						});
					}
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Enforce named effect functions for better debuggability. Prevents inline arrow functions in useEffect and similar hooks.",
			recommended: false,
		},
		messages: {
			anonymousFunction:
				"Anonymous function passed to {{hook}}. debug.info returns empty string for anonymous functions, making stack traces useless for debugging. Extract to: function effectName() { ... } then pass effectName.",
			arrowFunction:
				"Arrow function passed to {{hook}}. Arrow functions have no debug name and create new instances each render. Extract to: function effectName() { ... } then pass effectName.",
			asyncAnonymousFunction:
				"Async anonymous function in {{hook}}. Two issues: (1) no debug name makes stack traces useless, (2) async effects require cancellation logic for unmount. Extract to: async function effectName() { ... } with cleanup.",
			asyncArrowFunction:
				"Async arrow function in {{hook}}. Two issues: (1) arrow functions have no debug name, (2) async effects require cancellation logic. Extract to: async function effectName() { ... } with cleanup.",
			asyncFunctionDeclaration:
				"Async function declaration passed to {{hook}}. Async effects require cancellation logic to handle component unmount. Implement cleanup or set allowAsync: true if cancellation is handled.",
			asyncFunctionExpression:
				"Async function expression in {{hook}}. Async effects require cancellation logic for unmount. Extract to a named async function declaration with cleanup, then pass the reference.",
			functionExpression:
				"Function expression passed to {{hook}}. Function expressions create new instances each render, breaking referential equality. Extract to: function effectName() { ... } at module or component top-level.",
			identifierReferencesArrow:
				"{{hook}} receives identifier pointing to arrow function. Arrow functions have no debug name and lack referential stability. Convert to: function effectName() { ... } then pass effectName.",
			identifierReferencesAsyncArrow:
				"{{hook}} receives identifier pointing to async arrow function. Two issues: (1) no debug name, (2) async effects require cancellation logic. Convert to: async function effectName() { ... } with cleanup.",
			identifierReferencesAsyncFunction:
				"{{hook}} receives identifier pointing to async function. Async effects require cancellation logic for unmount. Implement cleanup or set allowAsync: true if cancellation is handled.",
			identifierReferencesCallback:
				"{{hook}} receives identifier from useCallback/useMemo. These hooks return new references when dependencies change, causing unexpected effect re-runs. Use a stable function declaration: function effectName() { ... }",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					environment: {
						default: "roblox-ts",
						description:
							"Environment mode: 'roblox-ts' only allows identifiers, 'standard' allows both identifiers and named function expressions",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
					hooks: {
						description: "Array of hook configuration objects with name and allowAsync settings",
						items: {
							additionalProperties: false,
							properties: {
								allowAsync: {
									description: "Whether async functions are allowed for this hook",
									type: "boolean",
								},
								name: {
									description: "Hook name to check",
									type: "string",
								},
							},
							required: ["name", "allowAsync"],
							type: "object",
						},
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default requireNamedEffectFunctions;
