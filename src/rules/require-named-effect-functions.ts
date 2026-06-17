import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { getHookName } from "$oxc-utilities/react-hook-utilities";
import { isEnvironment } from "$oxc-utilities/react-utilities";
import { isRecord, isStringRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

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
	return isRecord(value) && isStringRaw(value.name) && typeof value.allowAsync === "boolean";
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

interface ResolvedArrowFunction {
	readonly isAsync: boolean;
	readonly node: ESTree.ArrowFunctionExpression;
	readonly type: "arrow";
}

interface ResolvedFunctionDeclaration {
	readonly isAsync: boolean;
	readonly node: ESTree.Function;
	readonly type: "function-declaration";
}

interface ResolvedFunctionExpression {
	readonly isAsync: boolean;
	readonly node: ESTree.Function;
	readonly type: "function-expression";
}

type ResolvedFunction = ResolvedArrowFunction | ResolvedFunctionDeclaration | ResolvedFunctionExpression;

type RequireNamedEffectFunctionsMessageId =
	| "anonymousFunction"
	| "arrowFunction"
	| "asyncAnonymousFunction"
	| "asyncArrowFunction"
	| "asyncFunctionDeclaration"
	| "asyncFunctionExpression"
	| "functionExpression"
	| "identifierReferencesArrow"
	| "identifierReferencesAsyncArrow"
	| "identifierReferencesAsyncFunction"
	| "identifierReferencesCallback";

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

		function reportHookIssue(
			hookName: string,
			node: ESTree.CallExpression,
			messageId: RequireNamedEffectFunctionsMessageId,
		): void {
			context.report({
				data: { hook: hookName },
				messageId,
				node,
			});
		}

		function reportCallbackIdentifier(
			hookName: string,
			node: ESTree.CallExpression,
			identifier: ESTree.IdentifierReference,
		): void {
			const scope = context.sourceCode.getScope(identifier);
			const variable = getVariableByName(scope, identifier.name);

			if (variable === undefined) {
				if (isCallbackHookResult(context.sourceCode, identifier)) {
					reportHookIssue(hookName, node, "identifierReferencesCallback");
				}
				return;
			}

			const resolved = resolveFunctionFromVariable(variable);

			if (resolved === undefined) {
				if (isCallbackHookResult(context.sourceCode, identifier)) {
					reportHookIssue(hookName, node, "identifierReferencesCallback");
				}
				return;
			}

			reportResolvedIdentifier(hookName, node, resolved);
		}

		function reportResolvedIdentifier(
			hookName: string,
			node: ESTree.CallExpression,
			resolved: ResolvedFunction,
		): void {
			if (resolved.type === "arrow") {
				if (resolved.isAsync && !isAsyncAllowed(hookName)) {
					reportHookIssue(hookName, node, "identifierReferencesAsyncArrow");
				} else if (!resolved.isAsync) {
					reportHookIssue(hookName, node, "identifierReferencesArrow");
				}
				return;
			}

			if (resolved.type === "function-expression") {
				reportResolvedFunctionExpression(hookName, node, resolved.node);
				return;
			}

			if (resolved.isAsync && !isAsyncAllowed(hookName)) {
				reportHookIssue(hookName, node, "identifierReferencesAsyncFunction");
			}
		}

		function reportResolvedFunctionExpression(
			hookName: string,
			node: ESTree.CallExpression,
			functionExpression: ESTree.Function,
		): void {
			if (functionExpression.id === null) {
				reportHookIssue(hookName, node, "anonymousFunction");
			} else if (isRobloxTsMode) {
				reportHookIssue(hookName, node, "functionExpression");
			}
		}

		function reportInlineFunctionExpression(
			hookName: string,
			node: ESTree.CallExpression,
			functionExpression: ESTree.Function,
		): void {
			const functionHasId = functionExpression.id !== null;

			if (functionHasId && functionExpression.async) {
				reportHookIssue(hookName, node, "asyncFunctionExpression");
			} else if (functionHasId && isRobloxTsMode) {
				reportHookIssue(hookName, node, "functionExpression");
			} else if (!functionHasId && functionExpression.async) {
				reportHookIssue(hookName, node, "asyncAnonymousFunction");
			} else if (!functionHasId) {
				reportHookIssue(hookName, node, "anonymousFunction");
			}
		}

		return {
			CallExpression(node): void {
				const hookName = getHookName(node);
				if (hookName === undefined || !effectHooks.has(hookName)) return;

				const [firstArgument] = node.arguments;
				if (firstArgument === undefined) return;

				if (firstArgument.type === "Identifier") {
					reportCallbackIdentifier(hookName, node, firstArgument);
					return;
				}

				if (firstArgument.type === "ArrowFunctionExpression") {
					if (firstArgument.async) {
						reportHookIssue(hookName, node, "asyncArrowFunction");
					} else {
						reportHookIssue(hookName, node, "arrowFunction");
					}
					return;
				}

				if (firstArgument.type === "FunctionExpression") {
					reportInlineFunctionExpression(hookName, node, firstArgument);
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
						default: [...DEFAULT_HOOKS],
						description: "Hook configuration objects with name and allowAsync settings.",
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
