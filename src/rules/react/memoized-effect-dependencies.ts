import { Predicate } from "effect";

import { createRule } from "$oxc-utilities/create-rule";
import {
	ARRAY_EXPRESSION,
	ARROW_FUNCTION_EXPRESSION,
	CLASS_EXPRESSION,
	FUNCTION_EXPRESSION,
	isArrayExpression,
	isArrayPattern,
	isAssignmentPattern,
	isCallExpression,
	isClassDeclaration,
	isFunctionDeclarationRaw,
	isIdentifierName,
	isMemberExpression,
	isRestElement,
	isSpreadElement,
	isVariableDeclaration,
	isVariableDeclarator,
	NEW_EXPRESSION,
	OBJECT_EXPRESSION,
	unwrapExpression,
} from "$oxc-utilities/oxc-utilities";
import {
	ENVIRONMENT_SCHEMA,
	forEachReactNamedImport,
	getReactSources,
	isEnvironment,
	ROBLOX_TS,
} from "$oxc-utilities/react-utilities";

import type { Definition, ESTree, Scope, Variable, Visitor } from "oxlint-plugin-utilities";
import type { UnknownRecord } from "type-fest";

type Mode = "aggressive" | "definite" | "moderate";
const enum Stability {
	Memoized = 1,
	Unknown = 2,
	Unmemoized = 3,
}

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
	ARRAY_EXPRESSION,
	ARROW_FUNCTION_EXPRESSION,
	CLASS_EXPRESSION,
	FUNCTION_EXPRESSION,
	NEW_EXPRESSION,
	OBJECT_EXPRESSION,
]);

function isMode(value: unknown): value is Mode {
	return value === "aggressive" || value === "definite" || value === "moderate";
}

function getMemberHookName(callee: ESTree.MemberExpression, reactNamespaces: ReadonlySet<string>): string | undefined {
	if (callee.computed || !isIdentifierName(callee.object) || !reactNamespaces.has(callee.object.name)) {
		return undefined;
	}
	/* v8 ignore next -- @preserve non-computed hook member properties are identifiers in parser output. */
	return isIdentifierName(callee.property) ? callee.property.name : undefined;
}

function getRootIdentifier(expression: ESTree.Expression): ESTree.IdentifierReference | undefined {
	let current = unwrapExpression(expression);
	while (isMemberExpression(current)) current = unwrapExpression(current.object);
	return isIdentifierName(current) ? current : undefined;
}

function isUnmemoizedInline(node: ESTree.Node): boolean {
	return UNMEMOIZED_INLINE_TYPES.has(node.type);
}

function getPatternElementName(element: ESTree.ArrayPattern["elements"][number]): string | undefined {
	/* v8 ignore next -- @preserve stable hook matching only asks about occupied dependency binding slots. */
	if (element === null) return undefined;
	if (isIdentifierName(element)) return element.name;
	if (isAssignmentPattern(element) && isIdentifierName(element.left)) return element.left.name;
	if (isRestElement(element) && isIdentifierName(element.argument)) return element.argument.name;
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

const enum StableKind {
	Index1 = 1,
	Whole = 2,
}

function lookupStableKind(name: string): StableKind | undefined {
	if (STABLE_HOOKS_WHOLE.has(name)) return StableKind.Whole;
	/* v8 ignore next -- @preserve stableHookIdentifiers is populated only from STABLE_HOOKS. */
	if (STABLE_HOOKS_INDEX1.has(name)) return StableKind.Index1;
	/* v8 ignore next -- @preserve stableHookIdentifiers is populated only from STABLE_HOOKS. */
	return undefined;
}

function isFunctionOrClassDeclaration(node: ESTree.Node): boolean {
	return isFunctionDeclarationRaw(node) || isClassDeclaration(node);
}

function isNonConstVariableDeclaration(parent: ESTree.Node): boolean {
	return isVariableDeclaration(parent) && parent.kind !== "const";
}

function getFallbackStability(mode: Mode): Stability {
	return mode === "definite" ? Stability.Unknown : Stability.Unmemoized;
}

function isStableIndex1Binding(
	stableKind: StableKind | undefined,
	id: ESTree.BindingPattern,
	variableName: string,
): boolean {
	return stableKind === StableKind.Index1 && isArrayPattern(id) && isIdentifierAtArrayIndex(id, variableName, 1);
}

function getUnwrappedInit(node: ESTree.VariableDeclarator): ESTree.Expression | undefined {
	/* v8 ignore next -- @preserve no-initializer declarators are intentionally treated as unknown. */
	if (node.init === null) return undefined;
	return unwrapExpression(node.init);
}

function shouldForceUnmemoized(mode: Mode, result: Stability): boolean {
	return mode === "aggressive" && result !== Stability.Memoized;
}

function registerConfiguredEffectHooks(rawOptions: UnknownRecord, effectHooks: Map<string, number>): void {
	if (!("hooks" in rawOptions) || !Array.isArray(rawOptions.hooks)) return;

	for (const hook of rawOptions.hooks) {
		/* v8 ignore next -- @preserve rule schema rejects hook entries without string names. */
		if (!Predicate.isObject(hook) || !("name" in hook) || !Predicate.isString(hook.name)) continue;
		const dependenciesIndex =
			"dependenciesIndex" in hook && Predicate.isNumber(hook.dependenciesIndex) ? hook.dependenciesIndex : 1;
		effectHooks.set(hook.name, dependenciesIndex);
	}
}

const memoizedEffectDependencies = createRule("memoized-effect-dependencies", "react", {
	create(context): Visitor {
		const [rawOptions] = context.options;
		const options = Predicate.isObject(rawOptions) ? rawOptions : {};
		const mode: Mode = "mode" in options && isMode(options.mode) ? options.mode : "definite";
		const environment =
			"environment" in options && isEnvironment(options.environment) ? options.environment : ROBLOX_TS;

		const effectHookNameToIndex = new Map(DEFAULT_EFFECT_HOOKS);
		registerConfiguredEffectHooks(options, effectHookNameToIndex);

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
			/* v8 ignore next -- @preserve each dependency identifier is a distinct parser node. */
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

		function isMemoHookCall({ callee }: ESTree.CallExpression): boolean {
			if (isIdentifierName(callee)) return memoHookIdentifiers.has(callee.name);
			if (isMemberExpression(callee)) {
				const hookName = getMemberHookName(callee, reactNamespaces);
				return hookName !== undefined && MEMO_HOOKS.has(hookName);
			}
			return false;
		}

		function getStableIdentifierKind(name: string): StableKind | undefined {
			const importedName = stableHookIdentifiers.get(name);
			if (importedName === undefined) return undefined;
			return lookupStableKind(importedName);
		}

		function getStableMemberKind(callee: ESTree.MemberExpression): StableKind | undefined {
			const hookName = getMemberHookName(callee, reactNamespaces);
			if (hookName === undefined) return undefined;
			return lookupStableKind(hookName);
		}

		function getStableHookKind({ callee }: ESTree.CallExpression): StableKind | undefined {
			if (isIdentifierName(callee)) return getStableIdentifierKind(callee.name);
			if (isMemberExpression(callee)) return getStableMemberKind(callee);
			return undefined;
		}

		function getDeclaratorStability(node: ESTree.VariableDeclarator, variableName: string): Stability {
			if (isNonConstVariableDeclaration(node.parent)) return getFallbackStability(mode);

			const init = getUnwrappedInit(node);
			/* v8 ignore next -- @preserve no-initializer declarators are intentionally treated as unknown. */
			if (init === undefined) return Stability.Unknown;
			if (isUnmemoizedInline(init)) return Stability.Unmemoized;

			if (isCallExpression(init)) return getCallInitializerStability(init, node.id, variableName);

			return Stability.Unknown;
		}

		function getDefinitionStability(definition: Definition, variableName: string): Stability {
			if (definition.type === "Parameter") return Stability.Unknown;
			/* v8 ignore next -- @preserve imports are module scoped and returned before definition inspection. */
			if (definition.type === "ImportBinding") return Stability.Memoized;

			const { node } = definition;
			if (isFunctionOrClassDeclaration(node)) return Stability.Unmemoized;
			if (!isVariableDeclarator(node)) return Stability.Unknown;

			return getDeclaratorStability(node, variableName);
		}

		function getCallInitializerStability(
			init: ESTree.CallExpression,
			id: ESTree.BindingPattern,
			variableName: string,
		): Stability {
			if (isMemoHookCall(init)) return Stability.Memoized;

			const stableKind = getStableHookKind(init);
			if (stableKind === StableKind.Whole) return Stability.Memoized;
			if (isStableIndex1Binding(stableKind, id, variableName)) return Stability.Memoized;

			return getFallbackStability(mode);
		}

		function scanDefinitionStabilities(variable: Variable): Stability {
			let sawMemoized = false;
			for (const definition of variable.defs) {
				const stability = getDefinitionStability(definition, variable.name);
				if (stability === Stability.Unmemoized) return Stability.Unmemoized;
				if (stability === Stability.Memoized) sawMemoized = true;
			}

			return sawMemoized ? Stability.Memoized : Stability.Unknown;
		}

		function getVariableStability(variable: Variable): Stability {
			const cached = variableStabilityCache.get(variable);
			if (cached !== undefined) return cached;

			if (isModuleScope(variable)) {
				variableStabilityCache.set(variable, Stability.Memoized);
				return Stability.Memoized;
			}

			const scanned = scanDefinitionStabilities(variable);
			const result = shouldForceUnmemoized(mode, scanned) ? Stability.Unmemoized : scanned;

			variableStabilityCache.set(variable, result);
			return result;
		}

		function reportUnmemoizedDependency(name: string, node: ESTree.Node): void {
			context.report({
				data: { name },
				messageId: "unmemoizedDependency",
				node,
			});
		}

		function handleDependencyElement(element: ESTree.ArrayExpressionElement): void {
			if (element === null) return;
			if (isSpreadElement(element)) {
				if (mode === "definite") return;
				reportUnmemoizedDependency(sourceCode.getText(element.argument), element.argument);
				return;
			}

			if (classifyDependency(element) !== Stability.Unmemoized) return;
			reportUnmemoizedDependency(sourceCode.getText(element), element);
		}

		function classifyDependency(node: ESTree.Expression): Stability {
			const unwrapped = unwrapExpression(node);
			if (isUnmemoizedInline(unwrapped)) return Stability.Unmemoized;
			if (isCallExpression(unwrapped)) return mode === "definite" ? Stability.Unknown : Stability.Unmemoized;

			const rootIdentifier = getRootIdentifier(unwrapped);
			if (rootIdentifier === undefined) return Stability.Unknown;

			const variable = resolveVariable(rootIdentifier);
			return variable === undefined ? Stability.Unknown : getVariableStability(variable);
		}

		function getDependenciesIndex({ callee }: ESTree.CallExpression): number | undefined {
			if (isIdentifierName(callee)) return effectHookIdentifiers.get(callee.name);
			if (isMemberExpression(callee)) {
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
				if (!isArrayExpression(dependenciesArgument)) return;

				for (const element of dependenciesArgument.elements) handleDependencyElement(element);
			},
			ImportDeclaration(node): void {
				forEachReactNamedImport(node, reactSources, reactNamespaces, (importedName, localName) => {
					if (effectHookNameToIndex.has(importedName)) {
						const fallbackIndex = effectHookNameToIndex.get(importedName);
						/* v8 ignore next -- @preserve guarded by has(importedName), so the fallback is defensive. */
						effectHookIdentifiers.set(localName, fallbackIndex ?? 1);
					}
					if (MEMO_HOOKS.has(importedName)) memoHookIdentifiers.add(localName);
					if (STABLE_HOOKS.has(importedName)) stableHookIdentifiers.set(localName, importedName);
				});
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
					environment: ENVIRONMENT_SCHEMA,
					hooks: {
						default: Array.from(DEFAULT_EFFECT_HOOKS, ([name, dependenciesIndex]) => ({
							name,
							dependenciesIndex,
						})),
						description: "Effect hooks checked by default; configured entries are added to this set.",
						items: {
							additionalProperties: false,
							properties: {
								name: {
									description: "The name of the hook",
									type: "string",
								},
								dependenciesIndex: {
									description: "Index of the dependencies array for validation",
									type: "number",
								},
							},
							required: ["name"],
							type: "object",
						},
						type: "array",
					},
					mode: {
						default: "definite" satisfies Mode,
						description:
							"Strictness for memoization detection: definite (only obvious), moderate (unknown calls and non-const), aggressive (any non-module).",
						enum: ["aggressive", "definite", "moderate"] satisfies ReadonlyArray<Mode>,
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
