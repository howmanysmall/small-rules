import { getDeclarationRemovalRange, getVariableByName, hasAttachedComments } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { getHookName } from "$oxc-utilities/react-hook-utilities";
import { isEnvironment } from "$oxc-utilities/react-utilities";
import { isRecord, isStringRaw } from "$oxc-utilities/type-utilities";

import type { ESTree, Fix, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { Environment } from "$oxc-utilities/react-utilities";

interface HookConfig {
	readonly name: string;
	readonly allowAsync: boolean;
}

interface EffectFunctionOptions {
	readonly environment: Environment;
	readonly hooks: ReadonlyArray<HookConfig>;
	readonly inlineFunctionDeclarations: boolean;
	readonly sloptor: boolean;
}

const DEFAULT_HOOKS = [
	{ name: "useEffect", allowAsync: false },
	{ name: "useLayoutEffect", allowAsync: false },
	{ name: "useInsertionEffect", allowAsync: false },
] as const;

function isHookConfiguration(value: unknown): value is HookConfig {
	/* v8 ignore next -- @preserve rule schema validates every hook entry before create() runs. */
	return isRecord(value) && isStringRaw(value.name) && typeof value.allowAsync === "boolean";
}

function parseOptions(rawOptions: unknown): EffectFunctionOptions {
	const sloptor = isRecord(rawOptions) && rawOptions.sloptor === true;
	const inlineFunctionDeclarations = isRecord(rawOptions) && rawOptions.inlineFunctionDeclarations === true;

	if (!isRecord(rawOptions)) {
		return { environment: "roblox-ts", hooks: DEFAULT_HOOKS, inlineFunctionDeclarations, sloptor };
	}

	/* v8 ignore next -- @preserve rule schema restricts environment to known values when provided. */
	const environment: Environment = isEnvironment(rawOptions.environment) ? rawOptions.environment : "roblox-ts";

	const rawHooks = rawOptions.hooks;
	/* v8 ignore next -- @preserve array check branches are both exercised; V8 branch tracking miscounts one. */
	if (!Array.isArray(rawHooks)) {
		return { environment, hooks: DEFAULT_HOOKS, inlineFunctionDeclarations, sloptor };
	}

	const hooks = new Array<HookConfig>();
	/* v8 ignore next -- @preserve rule schema validates every hook entry before create() runs. */
	for (const rawHook of rawHooks) if (isHookConfiguration(rawHook)) hooks.push(rawHook);

	if (hooks.length === 0) return { environment, hooks: DEFAULT_HOOKS, inlineFunctionDeclarations, sloptor };
	return { environment, hooks, inlineFunctionDeclarations, sloptor };
}

interface ResolvedArrowFunction {
	readonly isAsync: boolean;
	readonly node: ESTree.ArrowFunctionExpression;
	readonly type: "arrow";
}

interface FunnyResolvedFunction<TType extends "declaration" | "expression"> {
	readonly isAsync: boolean;
	readonly node: ESTree.Function;
	readonly type: `function-${TType}`;
}

type ResolvedFunction =
	| FunnyResolvedFunction<"declaration">
	| FunnyResolvedFunction<"expression">
	| ResolvedArrowFunction;

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

function isDeclarationRemovable(
	sourceCode: SourceCode,
	variable: ScopeVariable,
	declaration: ESTree.Function,
): boolean {
	if (variable.references.length !== 1) return false;

	const parentType = declaration.parent.type;
	if (parentType === "ExportNamedDeclaration" || parentType === "ExportDefaultDeclaration") return false;

	return !hasAttachedComments(sourceCode, declaration);
}

const requireNamedEffectFunctions = createRule("require-named-effect-functions", "react", {
	create(context): Visitor {
		const { environment, hooks, inlineFunctionDeclarations, sloptor } = parseOptions(context.options[0]);
		const hookAsyncConfig = new Map(hooks.map((hookConfig) => [hookConfig.name, hookConfig.allowAsync]));
		const effectHooks = new Set(hookAsyncConfig.keys());
		const isRobloxTsMode = environment === "roblox-ts" && !sloptor;

		function isAsyncAllowed(hookName: string): boolean {
			const result = hookAsyncConfig.get(hookName);
			/* v8 ignore next -- @preserve hookAsyncConfig is built from boolean schema-validated hook entries. */
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
				/* v8 ignore next -- @preserve isCallbackHookResult performs the same variable lookup and cannot be true here. */
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

			reportResolvedIdentifier(hookName, node, identifier, resolved, variable);
		}

		function reportResolvedIdentifier(
			hookName: string,
			node: ESTree.CallExpression,
			identifier: ESTree.IdentifierReference,
			resolved: ResolvedFunction,
			variable: ScopeVariable,
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

			if (resolved.isAsync) {
				if (!isAsyncAllowed(hookName)) {
					reportHookIssue(hookName, node, "identifierReferencesAsyncFunction");
				}
			} else if (!isRobloxTsMode && inlineFunctionDeclarations) {
				reportDeclarationReference(hookName, node, identifier, resolved.node, variable);
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

		function reportDeclarationReference(
			hookName: string,
			node: ESTree.CallExpression,
			identifier: ESTree.IdentifierReference,
			declaration: ESTree.Function,
			variable: ScopeVariable,
		): void {
			context.report({
				data: { hook: hookName },
				fix(fixer): Array<Fix> {
					const fixes: Array<Fix> = [fixer.replaceText(identifier, context.sourceCode.getText(declaration))];

					if (isDeclarationRemovable(context.sourceCode, variable, declaration)) {
						fixes.push(fixer.removeRange(getDeclarationRemovalRange(context.sourceCode.text, declaration)));
					}

					return fixes;
				},
				messageId: "identifierReferencesFunctionDeclaration",
				node,
			});
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
		fixable: "code",
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
			identifierReferencesFunctionDeclaration:
				"{{hook}} receives identifier pointing to a named function declaration. Convert it to an inline named function expression so the effect callback is self-contained: useEffect(function effectName() {}, [])",
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
								name: {
									description: "Hook name to check",
									type: "string",
								},
								allowAsync: {
									description: "Whether async functions are allowed for this hook",
									type: "boolean",
								},
							},
							required: ["name", "allowAsync"],
							type: "object",
						},
						type: "array",
					},
					inlineFunctionDeclarations: {
						default: false,
						description:
							"Convert effect callbacks that reference a named function declaration into inline named function expressions (standard and sloptor modes only), keeping the effect body visible to dependency analysis. When the declaration is only referenced by the effect and is not exported or commented, the fix also removes the now-unused declaration.",
						type: "boolean",
					},
					sloptor: {
						default: false,
						description:
							"Compile with sloptor (a Go-based roblox-ts compiler). Sloptor targets @rbxts/react like roblox-ts but supports standard TypeScript features, so the rule applies standard-mode behavior. Use with environment: 'roblox-ts'.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default requireNamedEffectFunctions;
