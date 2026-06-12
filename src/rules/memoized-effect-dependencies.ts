import { unwrapExpression } from "$oxc-utilities/ast-utilities";
import { getImportedName } from "$oxc-utilities/oxc-utilities";
import { getReactSources, isEnvironment, isReactImport } from "$oxc-utilities/react-utilities";
import { isRecord } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { Definition, ESTree, Scope, Variable, Visitor } from "oxlint-plugin-utilities";

type Mode = "aggressive" | "definite" | "moderate";
type Stability = "memoized" | "unknown" | "unmemoized";

const DEFAULT_EFFECT_HOOKS = new Map<string, number>([
	["useEffect", 1],
	["useInsertionEffect", 1],
	["useLayoutEffect", 1],
]);
const MEMO_HOOKS = new Set(["useCallback", "useMemo"]);
const STABLE_HOOKS_WHOLE = new Set(["useBinding", "useRef"]);
const STABLE_HOOKS_INDEX1 = new Set(["useReducer", "useState", "useTransition"]);
const STABLE_HOOKS = new Set([...STABLE_HOOKS_WHOLE, ...STABLE_HOOKS_INDEX1]);
const UNMEMOIZED_INLINE_TYPES = new Set([
	"ArrayExpression",
	"ArrowFunctionExpression",
	"ClassExpression",
	"FunctionExpression",
	"NewExpression",
	"ObjectExpression",
]);

function isMode(value: unknown): value is Mode {
	return value === "aggressive" || value === "definite" || value === "moderate";
}

function getMemberHookName(callee: ESTree.MemberExpression, reactNamespaces: ReadonlySet<string>): string | undefined {
	if (callee.computed) return undefined;
	if (callee.object.type !== "Identifier") return undefined;
	if (!reactNamespaces.has(callee.object.name)) return undefined;
	return callee.property.type === "Identifier" ? callee.property.name : undefined;
}

function getRootIdentifier(expression: ESTree.Expression): ESTree.IdentifierReference | undefined {
	let current = unwrapExpression(expression);
	while (current.type === "MemberExpression") {
		current = unwrapExpression(current.object);
	}
	return current.type === "Identifier" ? current : undefined;
}

function isUnmemoizedInline(node: ESTree.Node): boolean {
	return UNMEMOIZED_INLINE_TYPES.has(node.type);
}

function getPatternElementName(element: ESTree.ArrayPattern["elements"][number]): string | undefined {
	if (element === null) return undefined;
	if (element.type === "Identifier") return element.name;
	if (element.type === "AssignmentPattern" && element.left.type === "Identifier") return element.left.name;
	if (element.type === "RestElement" && element.argument.type === "Identifier") return element.argument.name;
	return undefined;
}

function isIdentifierAtArrayIndex(pattern: ESTree.ArrayPattern, identifierName: string, index: number): boolean {
	const element = pattern.elements[index];
	if (element === undefined || element === null) return false;
	return getPatternElementName(element) === identifierName;
}

function isModuleScope(variable: Variable): boolean {
	return variable.scope.type === "module" || variable.scope.type === "global";
}

const memoizedEffectDependencies = defineRule({
	create(context): Visitor {
		const [rawOptions] = context.options;
		const options = isRecord(rawOptions) ? rawOptions : {};
		const mode: Mode = "mode" in options && isMode(options.mode) ? options.mode : "definite";
		const environment =
			"environment" in options && isEnvironment(options.environment) ? options.environment : "roblox-ts";

		const effectHookNameToIndex = new Map(DEFAULT_EFFECT_HOOKS);
		if ("hooks" in options && Array.isArray(options.hooks)) {
			for (const hook of options.hooks) {
				if (!(isRecord(hook) && "name" in hook) || typeof hook.name !== "string") continue;
				const dependenciesIndex =
					"dependenciesIndex" in hook && typeof hook.dependenciesIndex === "number"
						? hook.dependenciesIndex
						: 1;
				effectHookNameToIndex.set(hook.name, dependenciesIndex);
			}
		}

		const reactSources = getReactSources(environment);
		const reactNamespaces = new Set<string>();
		const effectHookIdentifiers = new Map<string, number>();
		const memoHookIdentifiers = new Set<string>();
		const stableHookIdentifiers = new Map<string, string>();
		const identifierScopeCache = new WeakMap<ESTree.IdentifierReference, Scope>();
		const resolvedVariableCache = new WeakMap<Scope, Map<string, undefined | Variable>>();
		const variableStabilityCache = new WeakMap<Variable, Stability>();

		const { sourceCode } = context;

		function getIdentifierScope(identifier: ESTree.IdentifierReference): Scope {
			const cached = identifierScopeCache.get(identifier);
			if (cached !== undefined) return cached;

			const scope = sourceCode.getScope(identifier);
			identifierScopeCache.set(identifier, scope);
			return scope;
		}

		function resolveVariable(identifier: ESTree.IdentifierReference): undefined | Variable {
			const startingScope = getIdentifierScope(identifier);
			let cachedVariables = resolvedVariableCache.get(startingScope);
			if (cachedVariables === undefined) {
				cachedVariables = new Map<string, undefined | Variable>();
				resolvedVariableCache.set(startingScope, cachedVariables);
			} else if (cachedVariables.has(identifier.name)) {
				return cachedVariables.get(identifier.name);
			}

			let scope: null | Scope = startingScope;
			while (scope !== null) {
				const found = scope.set.get(identifier.name);
				if (found !== undefined) {
					cachedVariables.set(identifier.name, found);
					return found;
				}
				scope = scope.upper;
			}
			cachedVariables.set(identifier.name, undefined);
			return undefined;
		}

		function isMemoHookCall(node: ESTree.CallExpression): boolean {
			const { callee } = node;
			if (callee.type === "Identifier") return memoHookIdentifiers.has(callee.name);
			if (callee.type === "MemberExpression") {
				const hookName = getMemberHookName(callee, reactNamespaces);
				return hookName !== undefined && MEMO_HOOKS.has(hookName);
			}
			return false;
		}

		function getStableHookKind(node: ESTree.CallExpression): "index1" | "whole" | undefined {
			const { callee } = node;
			if (callee.type === "Identifier") {
				const importedName = stableHookIdentifiers.get(callee.name);
				if (importedName === undefined) return undefined;
				if (STABLE_HOOKS_WHOLE.has(importedName)) return "whole";
				if (STABLE_HOOKS_INDEX1.has(importedName)) return "index1";
				return undefined;
			}
			if (callee.type === "MemberExpression") {
				const hookName = getMemberHookName(callee, reactNamespaces);
				if (hookName === undefined) return undefined;
				if (STABLE_HOOKS_WHOLE.has(hookName)) return "whole";
				if (STABLE_HOOKS_INDEX1.has(hookName)) return "index1";
			}
			return undefined;
		}

		function getDefinitionStability(definition: Definition, variableName: string): Stability {
			if (definition.type === "Parameter") return "unknown";
			if (definition.type === "ImportBinding") return "memoized";

			const { node } = definition;
			if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") return "unmemoized";
			if (node.type !== "VariableDeclarator") return "unknown";

			const declarationParent = node.parent;
			if (declarationParent.type === "VariableDeclaration" && declarationParent.kind !== "const") {
				return mode === "definite" ? "unknown" : "unmemoized";
			}

			const init = node.init === null ? undefined : unwrapExpression(node.init);
			if (init === undefined) return "unknown";
			if (isUnmemoizedInline(init)) return "unmemoized";

			if (init.type === "CallExpression") {
				if (isMemoHookCall(init)) return "memoized";

				const stableKind = getStableHookKind(init);
				if (stableKind === "whole") return "memoized";

				if (
					stableKind === "index1" &&
					node.id.type === "ArrayPattern" &&
					isIdentifierAtArrayIndex(node.id, variableName, 1)
				) {
					return "memoized";
				}
				return mode === "definite" ? "unknown" : "unmemoized";
			}

			return "unknown";
		}

		function getVariableStability(variable: Variable): Stability {
			const cached = variableStabilityCache.get(variable);
			if (cached !== undefined) return cached;

			if (isModuleScope(variable)) {
				variableStabilityCache.set(variable, "memoized");
				return "memoized";
			}

			let sawMemoized = false;
			for (const definition of variable.defs) {
				const stability = getDefinitionStability(definition, variable.name);
				if (stability === "unmemoized") {
					variableStabilityCache.set(variable, "unmemoized");
					return "unmemoized";
				}
				if (stability === "memoized") sawMemoized = true;
			}

			let result: Stability = sawMemoized ? "memoized" : "unknown";
			if (mode === "aggressive" && result !== "memoized") result = "unmemoized";

			variableStabilityCache.set(variable, result);
			return result;
		}

		function classifyDependency(node: ESTree.Expression): Stability {
			const unwrapped = unwrapExpression(node);
			if (isUnmemoizedInline(unwrapped)) return "unmemoized";
			if (unwrapped.type === "CallExpression") {
				return mode === "definite" ? "unknown" : "unmemoized";
			}

			const rootIdentifier = getRootIdentifier(unwrapped);
			if (rootIdentifier === undefined) return "unknown";
			const variable = resolveVariable(rootIdentifier);
			return variable === undefined ? "unknown" : getVariableStability(variable);
		}

		function getDependenciesIndex(node: ESTree.CallExpression): number | undefined {
			const { callee } = node;
			if (callee.type === "Identifier") return effectHookIdentifiers.get(callee.name);
			if (callee.type === "MemberExpression") {
				const hookName = getMemberHookName(callee, reactNamespaces);
				return hookName === undefined ? undefined : effectHookNameToIndex.get(hookName);
			}
			return undefined;
		}

		return {
			CallExpression(node): void {
				const dependenciesIndex = getDependenciesIndex(node);
				if (dependenciesIndex === undefined) return;

				const dependenciesArgument = node.arguments[dependenciesIndex];
				if (dependenciesArgument?.type !== "ArrayExpression") return;

				for (const element of dependenciesArgument.elements) {
					if (element === null) continue;
					if (element.type === "SpreadElement") {
						if (mode === "definite") continue;
						const spreadTarget = element.argument;
						const spreadName = sourceCode.getText(spreadTarget);
						context.report({
							data: { name: spreadName },
							messageId: "unmemoizedDependency",
							node: spreadTarget,
						});
						continue;
					}

					const stability = classifyDependency(element);
					if (stability !== "unmemoized") continue;

					const name = sourceCode.getText(element);
					context.report({
						data: { name },
						messageId: "unmemoizedDependency",
						node: element,
					});
				}
			},
			ImportDeclaration(node): void {
				if (!isReactImport(node, reactSources)) return;

				for (const specifier of node.specifiers) {
					if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportNamespaceSpecifier") {
						reactNamespaces.add(specifier.local.name);
						continue;
					}

					const importedName = getImportedName(specifier);
					if (importedName === undefined) continue;

					if (effectHookNameToIndex.has(importedName)) {
						const fallbackIndex = effectHookNameToIndex.get(importedName);
						effectHookIdentifiers.set(specifier.local.name, fallbackIndex ?? 1);
					}
					if (MEMO_HOOKS.has(importedName)) memoHookIdentifiers.add(specifier.local.name);
					if (STABLE_HOOKS.has(importedName)) stableHookIdentifiers.set(specifier.local.name, importedName);
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Flags effect dependencies that are not memoized. Unmemoized dependencies can cause unnecessary re-renders or infinite loops.",
		},
		messages: {
			unmemoizedDependency:
				"{{name}} is not memoized. Wrap it in useMemo/useCallback or move it to module scope.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					environment: {
						default: "roblox-ts",
						description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
					hooks: {
						description: "Array of effect hook entries to check for memoized dependencies",
						items: {
							additionalProperties: false,
							properties: {
								dependenciesIndex: {
									description: "Index of the dependencies array for validation",
									type: "number",
								},
								name: {
									description: "The name of the hook",
									type: "string",
								},
							},
							required: ["name"],
							type: "object",
						},
						type: "array",
					},
					mode: {
						default: "definite",
						description:
							"Strictness for memoization detection: definite (only obvious), moderate (unknown calls and non-const), aggressive (any non-module).",
						enum: ["aggressive", "definite", "moderate"],
						type: "string",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default memoizedEffectDependencies;
