import { isNode } from "$oxc-utilities/oxc-utilities";
import { isRecord } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { Context, ESTree, Fix, Scope, SourceCode, Visitor } from "oxlint-plugin-utilities";

const FUNCTION_DECLARATIONS = new Set<string>(["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"]);

const UNSTABLE_VALUES = new Set<string>([
	"ArrayExpression",
	"ArrowFunctionExpression",
	"FunctionDeclaration",
	"FunctionExpression",
	"ObjectExpression",
]);

interface HookEntry {
	readonly closureIndex?: number;
	readonly dependenciesIndex?: number;
	readonly name: string;
	readonly stableResult?: boolean | number | ReadonlyArray<number> | ReadonlyArray<string>;
}

interface UseExhaustiveDependenciesOptions {
	readonly hooks?: ReadonlyArray<HookEntry>;
	readonly reportMissingDependenciesArray?: boolean;
	readonly reportUnnecessaryDependencies?: boolean;
	readonly reportUnnecessaryStableDependencies?: boolean;
	readonly resolveExpressionDependencies?: boolean;
}

interface HookConfig {
	readonly closureIndex: number;
	readonly dependenciesIndex: number;
}

type StableResult = boolean | ReadonlySet<number> | ReadonlySet<string>;

interface VariableDefinitionLike {
	readonly node: ESTree.Node;
	readonly type: string;
}

interface VariableLike {
	readonly defs: ReadonlyArray<VariableDefinitionLike>;
}

interface DependencyInfo {
	readonly depth: number;
	readonly name: string;
	readonly node: ESTree.Node;
}

interface CaptureInfo {
	readonly depth: number;
	readonly forceDependency: boolean;
	readonly name: string;
	readonly node: ESTree.Node;
	readonly usagePath: string;
	readonly variable: undefined | VariableLike;
}

const DEFAULT_HOOKS = new Map<string, HookConfig>([
	["useCallback", { closureIndex: 0, dependenciesIndex: 1 }],
	["useEffect", { closureIndex: 0, dependenciesIndex: 1 }],
	["useImperativeHandle", { closureIndex: 1, dependenciesIndex: 2 }],
	["useInsertionEffect", { closureIndex: 0, dependenciesIndex: 1 }],
	["useLayoutEffect", { closureIndex: 0, dependenciesIndex: 1 }],
	["useMemo", { closureIndex: 0, dependenciesIndex: 1 }],
	["useSpring", { closureIndex: 0, dependenciesIndex: 1 }],
	["useSprings", { closureIndex: 1, dependenciesIndex: 2 }],
	["useTrail", { closureIndex: 1, dependenciesIndex: 2 }],
]);

const STABLE_HOOKS = new Map<string, StableResult>([
	["useBinding", true],
	["useReducer", new Set([1])],
	["useRef", true],
	["useState", new Set([1])],
	["useTransition", new Set([1])],
]);

const STABLE_VALUE_TYPES = new Set(["ClassDeclaration", "FunctionDeclaration", "FunctionName", "ImportBinding"]);

const GLOBAL_BUILTINS = new Set([
	"Array",
	"BigInt",
	"Boolean",
	"clearInterval",
	"clearTimeout",
	"console",
	"Date",
	"decodeURI",
	"decodeURIComponent",
	"Document",
	"Element",
	"encodeURI",
	"encodeURIComponent",
	"Error",
	"Event",
	"Exclude",
	"Extract",
	"Function",
	"Infinity",
	"InstanceType",
	"isFinite",
	"isNaN",
	"JSON",
	"Map",
	"Math",
	"NaN",
	"Node",
	"NonNullable",
	"null",
	"Number",
	"Object",
	"Omit",
	"Parameters",
	"parseFloat",
	"parseInt",
	"Partial",
	"Pick",
	"Promise",
	"Readonly",
	"ReadonlyArray",
	"ReadonlyMap",
	"ReadonlySet",
	"Record",
	"RegExp",
	"Required",
	"ReturnType",
	"Set",
	"setInterval",
	"setTimeout",
	"String",
	"Symbol",
	"undefined",
	"WeakMap",
	"WeakSet",
	"Window",
]);

function getHookName(node: ESTree.CallExpression): string | undefined {
	const { callee } = node;

	if (callee.type === "Identifier") return callee.name;

	if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
		return callee.property.name;
	}

	return undefined;
}

function getMemberExpressionDepth(node: ESTree.Node): number {
	let depth = 0;
	let current: ESTree.Node = node;

	if (current.type === "ChainExpression") current = current.expression;

	while (current.type === "MemberExpression") {
		depth += 1;
		current = current.object;
	}

	return depth;
}

function getRootIdentifier(node: ESTree.Node): ESTree.Node | undefined {
	let current: ESTree.Node = node;

	if (current.type === "ChainExpression") current = current.expression;

	while (current.type === "MemberExpression" || current.type === "TSNonNullExpression") {
		current = current.type === "MemberExpression" ? current.object : current.expression;
	}

	return current.type === "Identifier" ? current : undefined;
}

function collectIdentifierNames(node: ESTree.Node): ReadonlyArray<string> {
	if (node.type === "Identifier") return [node.name];
	if (node.type === "MemberExpression") return collectIdentifierNames(node.object);
	if (node.type === "ChainExpression") return collectIdentifierNames(node.expression);
	if (
		node.type === "TSNonNullExpression" ||
		node.type === "TSAsExpression" ||
		node.type === "TSSatisfiesExpression" ||
		node.type === "TSTypeAssertion"
	) {
		return collectIdentifierNames(node.expression);
	}
	if (node.type === "BinaryExpression" || node.type === "LogicalExpression") {
		return [...collectIdentifierNames(node.left), ...collectIdentifierNames(node.right)];
	}
	if (node.type === "UnaryExpression") return collectIdentifierNames(node.argument);
	if (node.type === "ConditionalExpression") {
		return [
			...collectIdentifierNames(node.test),
			...collectIdentifierNames(node.consequent),
			...collectIdentifierNames(node.alternate),
		];
	}

	return new Array<string>();
}

function isExpression(
	node: ESTree.Node,
): node is ESTree.TSAsExpression | ESTree.TSNonNullExpression | ESTree.TSSatisfiesExpression {
	return TS_RUNTIME_EXPRESSIONS.has(node.type);
}

function nodeToSafeDependencyPath(node: ESTree.Node, sourceCode: SourceCode): string {
	if (node.type === "Identifier") return node.name;
	if (node.type === "ChainExpression" || isExpression(node)) {
		return nodeToSafeDependencyPath(node.expression, sourceCode);
	}

	if (node.type === "MemberExpression") {
		const objectPath = nodeToSafeDependencyPath(node.object, sourceCode);
		if (node.computed) {
			const propertyText = sourceCode.getText(node.property);
			return `${objectPath}[${propertyText}]`;
		}
		const propertyName = node.property.type === "Identifier" ? node.property.name : "";
		const separator = node.optional ? "?." : ".";
		return `${objectPath}${separator}${propertyName}`;
	}

	return sourceCode.getText(node);
}

function isStableArrayIndex(
	stableResult: StableResult | undefined,
	node: ESTree.Node,
	identifierName: string,
): boolean {
	if (stableResult === undefined) return false;
	if (!(stableResult instanceof Set) || node.type !== "VariableDeclarator" || node.id.type !== "ArrayPattern") {
		return false;
	}

	const { elements } = node.id;
	let index = 0;
	for (const element of elements) {
		const name = element?.type === "Identifier" ? element.name : undefined;
		if (name === identifierName) return stableResult.has(index);

		index += 1;
	}

	return false;
}

function isStableHookValue(
	init: ESTree.Expression | null,
	node: ESTree.Node,
	identifierName: string,
	stableHooks: Map<string, StableResult>,
): boolean {
	if (init?.type !== "CallExpression") return false;

	const hookName = getHookName(init);
	if (hookName === undefined) return false;

	const stableResult = stableHooks.get(hookName);
	return stableResult === true ? true : isStableArrayIndex(stableResult, node, identifierName);
}

function isStableValue(
	variable: undefined | VariableLike,
	identifierName: string,
	stableHooks: Map<string, StableResult>,
): boolean {
	if (!variable) return false;

	const definitions = variable.defs;
	if (definitions.length === 0) return false;

	for (const definition of definitions) {
		const { node, type } = definition;

		if (STABLE_VALUE_TYPES.has(type)) return true;

		if (type === "Variable" && node.type === "VariableDeclarator") {
			const declarator = node;
			const { parent } = declarator;
			if (parent.type !== "VariableDeclaration" || parent.kind !== "const") continue;

			const { init } = declarator;
			if (init && isStableHookValue(init, node, identifierName, stableHooks)) return true;

			if (init?.type === "CallExpression") {
				const { callee } = init;

				if (
					callee.type === "MemberExpression" &&
					callee.object.type === "Identifier" &&
					callee.object.name === "React" &&
					callee.property.type === "Identifier" &&
					callee.property.name === "joinBindings"
				) {
					return true;
				}

				if (
					callee.type === "MemberExpression" &&
					callee.property.type === "Identifier" &&
					callee.property.name === "map"
				) {
					return true;
				}
			}

			if (
				init &&
				(init.type === "Literal" ||
					init.type === "TemplateLiteral" ||
					(init.type === "UnaryExpression" && init.argument.type === "Literal"))
			) {
				return true;
			}

			const variableDefinition = variable.defs.find((matchedDefinition) => matchedDefinition.node === node);
			if (variableDefinition?.node.type === "VariableDeclarator") {
				const declarationNode = variableDefinition.node;
				const declarationParent = declarationNode.parent.parent;
				if (
					declarationParent &&
					(declarationParent.type === "Program" || declarationParent.type === "ExportNamedDeclaration")
				) {
					return true;
				}
			}
		}
	}

	return false;
}

function findTopmostMemberExpression(node: ESTree.Node, parent?: ESTree.Node): ESTree.Node {
	let currentParent: ESTree.Node | undefined = parent;
	let current: ESTree.Node = node;

	while (currentParent) {
		if (currentParent.type === "CallExpression" && currentParent.callee === current) {
			if (current.type === "MemberExpression") return current.object;
			break;
		}

		const isMemberParent = currentParent.type === "MemberExpression" && currentParent.object === current;
		const isChainParent = currentParent.type === "ChainExpression";
		const isNonNullParent = currentParent.type === "TSNonNullExpression";

		if (!(isMemberParent || isChainParent || isNonNullParent)) break;

		current = currentParent;
		currentParent = current.parent ?? undefined;
	}

	return current;
}

const IS_CEASE_BOUNDARY = new Set<string>([
	"ArrowFunctionExpression",
	"FunctionDeclaration",
	"FunctionExpression",
	"VariableDeclarator",
]);

const TS_RUNTIME_EXPRESSIONS = new Set<string>([
	"TSAsExpression",
	"TSInstantiationExpression",
	"TSNonNullExpression",
	"TSSatisfiesExpression",
	"TSTypeAssertion",
]);

function isComputedPropertyIdentifier(identifier: ESTree.Node): boolean {
	if (identifier.type !== "Identifier") return false;
	const { parent } = identifier;
	return parent.type === "Property" && parent.computed && parent.key === identifier;
}

function isInTypePosition(identifier: ESTree.Node): boolean {
	if (identifier.type !== "Identifier") return false;
	let parent: ESTree.Node | undefined = identifier.parent ?? undefined;

	while (parent) {
		if (TS_RUNTIME_EXPRESSIONS.has(parent.type)) {
			parent = parent.parent ?? undefined;
			continue;
		}
		if (parent.type.startsWith("TS")) return true;
		if (IS_CEASE_BOUNDARY.has(parent.type)) return false;
		parent = parent.parent ?? undefined;
	}

	return false;
}

function isDeclaredInComponentBody(variable: VariableLike, closureNode: ESTree.Node): boolean {
	let parent: ESTree.Node | undefined = closureNode.parent ?? undefined;

	while (parent) {
		const isFunction = FUNCTION_DECLARATIONS.has(parent.type);

		if (isFunction) {
			const functionParent = parent;

			const isParameter = variable.defs.some((definition) => {
				if (definition.type !== "Parameter") return false;
				return definition.node === functionParent;
			});

			if (isParameter) return true;

			return variable.defs.some((definition) => {
				let definitionNode: ESTree.Node | undefined = definition.node.parent ?? undefined;
				while (definitionNode && definitionNode !== functionParent) {
					definitionNode = definitionNode.parent ?? undefined;
				}
				return definitionNode === functionParent;
			});
		}

		parent = parent.parent ?? undefined;
	}

	return false;
}

function resolveFunctionReference(identifier: ESTree.Node, scope: Scope): ESTree.Node | undefined {
	if (identifier.type !== "Identifier") return undefined;

	let variable: Scope["set"]["get"] extends (key: string) => infer TReturn ? TReturn : never;
	let currentScope: null | Scope = scope;

	while (currentScope) {
		const currentVariable = currentScope.set.get(identifier.name);
		if (currentVariable) {
			variable = currentVariable;
			break;
		}
		currentScope = currentScope.upper;
	}

	if (!variable || variable.defs.length === 0) return undefined;

	for (const definition of variable.defs) {
		const definitionNode = definition.node;
		if (definitionNode.type === "FunctionDeclaration") return definitionNode;

		if (
			definitionNode.type === "VariableDeclarator" &&
			definitionNode.init &&
			(definitionNode.init.type === "ArrowFunctionExpression" ||
				definitionNode.init.type === "FunctionExpression")
		) {
			return definitionNode.init;
		}
	}

	return undefined;
}

function collectCaptures(node: ESTree.Node, sourceCode: SourceCode): ReadonlyArray<CaptureInfo> {
	const captures = new Array<CaptureInfo>();
	const captureSet = new Set<string>();

	function visit(current: ESTree.Node): void {
		if (current.type === "Identifier") {
			const { name } = current;

			if (captureSet.has(name) || GLOBAL_BUILTINS.has(name) || isInTypePosition(current)) return;

			let variable: Scope["set"]["get"] extends (key: string) => infer TReturn ? TReturn : never;
			let currentScope: null | Scope = sourceCode.getScope(current);

			while (currentScope) {
				const currentVariable = currentScope.set.get(name);
				if (currentVariable) {
					variable = currentVariable;
					break;
				}
				currentScope = currentScope.upper;
			}

			if (variable) {
				const isDefinedInClosure = variable.defs.some((definition) => {
					let definitionNode: ESTree.Node | undefined = definition.node;
					while (definitionNode) {
						if (definitionNode === node) return true;
						definitionNode = definitionNode.parent ?? undefined;
					}
					return false;
				});

				if (!isDefinedInClosure) {
					if (!isDeclaredInComponentBody(variable as VariableLike, node)) {
						return;
					}

					captureSet.add(name);
					const depthNode = findTopmostMemberExpression(current, current.parent);
					const usagePath = nodeToSafeDependencyPath(depthNode, sourceCode);
					const depth = getMemberExpressionDepth(depthNode);
					captures.push({
						depth,
						forceDependency: isComputedPropertyIdentifier(current),
						name,
						node: depthNode,
						usagePath,
						variable: variable as VariableLike,
					});
				}
			}
		}

		if (
			current.type === "TSSatisfiesExpression" ||
			current.type === "TSAsExpression" ||
			current.type === "TSTypeAssertion" ||
			current.type === "TSNonNullExpression"
		) {
			visit(current.expression);
			return;
		}

		if (current.type === "MemberExpression") {
			visit(current.object);
			if (current.computed) visit(current.property);
			return;
		}

		if (current.type === "ChainExpression") {
			visit(current.expression);
			return;
		}

		if (current.type === "Property") {
			if (current.computed) visit(current.key);
			visit(current.value);
			return;
		}

		const keys = sourceCode.visitorKeys[current.type] ?? [];
		for (const key of keys) {
			if (!isRecord(current)) break;
			const value = current[key];
			if (Array.isArray(value)) {
				for (const item of value) if (isNode(item)) visit(item);
			} else if (isNode(value)) visit(value);
		}
	}

	visit(node);
	return captures;
}

function parseDependencies(node: ESTree.ArrayExpression, sourceCode: SourceCode): ReadonlyArray<DependencyInfo> {
	const dependencies = new Array<DependencyInfo>();

	for (const element of node.elements) {
		if (!element) continue;

		const actualNode = element.type === "SpreadElement" ? element.argument : element;

		const name = sourceCode.getText(actualNode);
		const depth = getMemberExpressionDepth(actualNode);

		dependencies.push({
			depth,
			name,
			node: actualNode,
		});
	}

	return dependencies;
}

function returnName({ name }: { readonly name: string }): string {
	return name;
}

function isUnstableValue(node: ESTree.Node | undefined): boolean {
	return node ? UNSTABLE_VALUES.has(node.type) : false;
}

function isSelfReferenceCapture(capture: CaptureInfo, { parent }: ESTree.CallExpression): boolean {
	return parent.type === "VariableDeclarator"
		? (capture.variable?.defs.some((definition) => definition.node === parent) ?? false)
		: false;
}

function isNumericArray(array: ReadonlyArray<unknown>): array is Array<number> {
	return array.length > 0 && typeof array[0] === "number";
}
function isStringArray(array: ReadonlyArray<unknown>): array is Array<string> {
	return array.length > 0 && typeof array[0] === "string";
}

function convertStableResult(
	stableResult: boolean | number | ReadonlyArray<number> | ReadonlyArray<string>,
): StableResult {
	if (typeof stableResult === "boolean") return stableResult;
	if (typeof stableResult === "number") return new Set([stableResult]);

	if (Array.isArray(stableResult)) {
		if (isNumericArray(stableResult)) return new Set(stableResult);
		if (isStringArray(stableResult)) return new Set(stableResult);
	}

	return false;
}

function reportUnnecessaryDependency(
	context: Context<readonly [Partial<UseExhaustiveDependenciesOptions>], MessageIds>,
	dependencies: ReadonlyArray<DependencyInfo>,
	dependency: DependencyInfo,
	dependenciesArray: ESTree.ArrayExpression,
): void {
	const newDependencies = new Array<string>();
	let size = 0;
	for (const { name } of dependencies) {
		if (name === dependency.name) continue;
		newDependencies[size++] = name;
	}
	const dependenciesString = `[${newDependencies.join(", ")}]`;

	context.report({
		data: { name: dependency.name },
		fix(fixer): Fix {
			return fixer.replaceText(dependenciesArray, dependenciesString);
		},
		messageId: "unnecessaryDependency",
		node: dependency.node,
		suggest: [
			{
				data: { name: dependency.name },
				fix(fixer): Fix {
					return fixer.replaceText(dependenciesArray, dependenciesString);
				},
				messageId: "removeDependencySuggestion",
			},
		],
	});
}

type MessageIds =
	| "addDependenciesArraySuggestion"
	| "addDependencySuggestion"
	| "addMissingDependenciesSuggestion"
	| "missingDependencies"
	| "missingDependenciesArray"
	| "missingDependency"
	| "removeDependencySuggestion"
	| "unnecessaryDependency"
	| "unstableDependency";

const useExhaustiveDependencies = defineRule({
	create(context): Visitor {
		const [options] = context.options;
		const resolvedOptions: Required<UseExhaustiveDependenciesOptions> = {
			hooks: options?.hooks ?? [],
			reportMissingDependenciesArray: options?.reportMissingDependenciesArray ?? true,
			reportUnnecessaryDependencies: options?.reportUnnecessaryDependencies ?? true,
			reportUnnecessaryStableDependencies: options?.reportUnnecessaryStableDependencies ?? false,
			resolveExpressionDependencies: options?.resolveExpressionDependencies ?? true,
		};

		const hookConfigs = new Map<string, HookConfig>(DEFAULT_HOOKS);
		for (const customHook of resolvedOptions.hooks) {
			if (customHook.closureIndex === undefined || customHook.dependenciesIndex === undefined) continue;
			hookConfigs.set(customHook.name, {
				closureIndex: customHook.closureIndex,
				dependenciesIndex: customHook.dependenciesIndex,
			});
		}

		const stableHooks = new Map<string, StableResult>(STABLE_HOOKS);
		for (const customHook of resolvedOptions.hooks) {
			if (customHook.stableResult === undefined) continue;
			stableHooks.set(customHook.name, convertStableResult(customHook.stableResult));
		}

		const scopeCache = new WeakMap<ESTree.Node, Scope>();

		function getScope(node: ESTree.Node): Scope {
			const cached = scopeCache.get(node);
			if (cached) return cached;

			const scope = context.sourceCode.getScope(node);
			scopeCache.set(node, scope);
			return scope;
		}

		return {
			CallExpression(node): void {
				const hookName = getHookName(node);
				if (hookName === undefined || hookName === "") return;

				const hookConfig = hookConfigs.get(hookName);
				if (!hookConfig) return;

				const { closureIndex, dependenciesIndex } = hookConfig;
				const parameters = node.arguments;

				const closureArgument = parameters[closureIndex];
				if (closureArgument === undefined) return;

				let closureFunction: CallbackFunction | undefined;

				if (closureArgument.type === "ArrowFunctionExpression") closureFunction = closureArgument;
				else if (
					closureArgument.type === "FunctionExpression" ||
					closureArgument.type === "FunctionDeclaration" ||
					closureArgument.type === "Identifier"
				) {
					const scope = getScope(node);
					const resolved = resolveFunctionReference(closureArgument, scope);
					if (
						resolved &&
						(resolved.type === "ArrowFunctionExpression" ||
							resolved.type === "FunctionExpression" ||
							resolved.type === "FunctionDeclaration")
					) {
						closureFunction = resolved;
					}
				}

				if (!closureFunction) return;

				const dependenciesArgument = parameters[dependenciesIndex];
				if (!dependenciesArgument && resolvedOptions.reportMissingDependenciesArray) {
					const captures = collectCaptures(closureFunction, context.sourceCode).filter(
						(capture) => !isSelfReferenceCapture(capture, node),
					);

					const requiredCaptures = captures.filter(
						(capture) =>
							capture.forceDependency || !isStableValue(capture.variable, capture.name, stableHooks),
					);

					if (requiredCaptures.length > 0) {
						const missingNames = [...new Set(requiredCaptures.map(returnName))].join(", ");

						const usagePaths = requiredCaptures.map(({ usagePath }) => usagePath);
						const uniqueDependencies = [...new Set(usagePaths)].toSorted();
						const dependenciesString = `[${uniqueDependencies.join(", ")}]`;

						context.report({
							data: { deps: missingNames },
							fix(fixer): Fix {
								return fixer.insertTextAfter(closureArgument, `, ${dependenciesString}`);
							},
							messageId: "missingDependenciesArray",
							node,
							suggest: [
								{
									data: { dependencies: dependenciesString },
									fix(fixer): Fix {
										return fixer.insertTextAfter(closureArgument, `, ${dependenciesString}`);
									},
									messageId: "addDependenciesArraySuggestion",
								},
							],
						});
					}
					return;
				}

				if (!dependenciesArgument) return;
				if (dependenciesArgument.type !== "ArrayExpression") return;
				const dependenciesArray = dependenciesArgument;
				const captures = collectCaptures(closureFunction, context.sourceCode).filter(
					(capture) => !isSelfReferenceCapture(capture, node),
				);

				const dependencies = parseDependencies(dependenciesArray, context.sourceCode);

				for (const dependency of dependencies) {
					const dependencyRootIdentifier = getRootIdentifier(dependency.node);
					if (!dependencyRootIdentifier) continue;
					if (dependencyRootIdentifier.type !== "Identifier") continue;

					const dependencyName = dependencyRootIdentifier.name;

					const matchingCaptures = captures.filter((capture) => {
						const captureNode = getRootIdentifier(capture.node);
						return (
							getRootIdentifier(capture.node)?.type === "Identifier" &&
							captureNode !== undefined &&
							"name" in captureNode &&
							captureNode.name === dependencyName
						);
					});

					const isStableDep =
						matchingCaptures.length > 0 &&
						matchingCaptures.every(
							(capture) =>
								!capture.forceDependency && isStableValue(capture.variable, capture.name, stableHooks),
						);

					if (matchingCaptures.length === 0) {
						if (resolvedOptions.reportUnnecessaryDependencies) {
							reportUnnecessaryDependency(context, dependencies, dependency, dependenciesArray);
						}
						continue;
					}

					if (isStableDep && resolvedOptions.reportUnnecessaryStableDependencies) {
						reportUnnecessaryDependency(context, dependencies, dependency, dependenciesArray);
						continue;
					}

					const maxCaptureDepth = Math.max(...matchingCaptures.map(({ depth }) => depth));
					if (dependency.depth > maxCaptureDepth && resolvedOptions.reportUnnecessaryDependencies) {
						reportUnnecessaryDependency(context, dependencies, dependency, dependenciesArray);
					}
				}

				const missingCaptures = new Array<CaptureInfo>();
				for (const capture of captures) {
					if (!capture.forceDependency && isStableValue(capture.variable, capture.name, stableHooks)) {
						continue;
					}

					const rootIdentifier = getRootIdentifier(capture.node);
					if (rootIdentifier?.type !== "Identifier") continue;

					const captureName = rootIdentifier.name;
					let isInDependencies = false;

					for (const dependency of dependencies) {
						const dependencyRootIdentifier = getRootIdentifier(dependency.node);

						if (dependencyRootIdentifier?.type === "Identifier" && dependency.depth <= capture.depth) {
							const dependencyName = dependencyRootIdentifier.name;
							if (dependencyName === captureName) {
								isInDependencies = true;
								break;
							}
						} else if (resolvedOptions.resolveExpressionDependencies) {
							const identifierNames = collectIdentifierNames(dependency.node);
							if (identifierNames.includes(captureName)) {
								isInDependencies = true;
								break;
							}
						}
					}

					if (!isInDependencies) missingCaptures.push(capture);
				}

				if (missingCaptures.length > 0) {
					const dependencyNames = dependencies.map(({ name }) => name);
					const missingPaths = missingCaptures.map(({ usagePath }) => usagePath);
					const newDependencies = [...dependencyNames, ...missingPaths].toSorted();
					const newDependenciesString = `[${newDependencies.join(", ")}]`;
					const lastDependency = dependencies.at(-1);
					const firstMissing = missingCaptures.at(0);

					if (missingCaptures.length === 1 && firstMissing) {
						context.report({
							data: { name: firstMissing.usagePath },
							fix(fixer): Fix {
								return fixer.replaceText(dependenciesArray, newDependenciesString);
							},
							messageId: "missingDependency",
							node: lastDependency?.node ?? dependenciesArray,
							suggest: [
								{
									data: { name: firstMissing.usagePath },
									fix(fixer): Fix {
										return fixer.replaceText(dependenciesArray, newDependenciesString);
									},
									messageId: "addDependencySuggestion",
								},
							],
						});
					} else {
						const missingNames = missingPaths.join(", ");
						context.report({
							data: { names: missingNames },
							fix(fixer): Fix {
								return fixer.replaceText(dependenciesArray, newDependenciesString);
							},
							messageId: "missingDependencies",
							node: lastDependency?.node ?? dependenciesArray,
							suggest: [
								{
									fix(fixer): Fix {
										return fixer.replaceText(dependenciesArray, newDependenciesString);
									},
									messageId: "addMissingDependenciesSuggestion",
								},
							],
						});
					}
				}

				for (const capture of captures) {
					if (!capture.forceDependency && isStableValue(capture.variable, capture.name, stableHooks)) {
						continue;
					}

					const rootIdentifier = getRootIdentifier(capture.node);
					if (rootIdentifier?.type !== "Identifier") continue;

					const captureName = rootIdentifier.name;

					for (const dependency of dependencies) {
						const dependencyRootIdentifier = getRootIdentifier(dependency.node);
						if (dependencyRootIdentifier?.type !== "Identifier") continue;

						const dependencyName = dependencyRootIdentifier.name;
						const isMatch = dependencyName === captureName && dependency.depth === capture.depth;
						const isDirectIdentifier = dependency.depth === 0;

						if (isMatch && isDirectIdentifier) {
							const variableDefinition = capture.variable?.defs[0];
							let initialNode: ESTree.Node | undefined;
							if (variableDefinition?.node.type === "VariableDeclarator") {
								initialNode = variableDefinition.node.init ?? undefined;
							}

							if (isUnstableValue(initialNode)) {
								context.report({
									data: { name: capture.usagePath },
									messageId: "unstableDependency",
									node: dependency.node,
								});
							}
							break;
						}
						if (isMatch) break;
					}
				}
			},
		};
	},
	meta: {
		docs: {
			description:
				"Enforce exhaustive and correct dependency specification in React hooks to prevent stale closures and unnecessary re-renders",
		},
		fixable: "code",
		hasSuggestions: true,
		messages: {
			addDependenciesArraySuggestion: "Add dependencies array: {{dependencies}}",
			addDependencySuggestion: "Add '{{name}}' to dependencies array",
			addMissingDependenciesSuggestion: "Add missing dependencies to array",
			missingDependencies: "This hook does not specify all its dependencies. Missing: {{names}}",
			missingDependenciesArray: "This hook does not specify its dependencies array. Missing: {{deps}}",
			missingDependency: "This hook does not specify its dependency on {{name}}.",
			removeDependencySuggestion: "Remove '{{name}}' from dependencies array",
			unnecessaryDependency: "This dependency {{name}} can be removed from the list.",
			unstableDependency:
				"{{name}} changes on every re-render. Wrap the definition in useCallback() or useMemo() to stabilize it.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					hooks: {
						description: "Array of custom hook entries to check for exhaustive dependencies",
						items: {
							additionalProperties: false,
							properties: {
								closureIndex: {
									description: "Index of the closure argument for dependency validation",
									type: "number",
								},
								dependenciesIndex: {
									description: "Index of the dependencies array for validation",
									type: "number",
								},
								name: {
									description: "The name of the hook",
									type: "string",
								},
								stableResult: {
									description:
										"Specify stable results: true (whole result), number (array index), number[] (multiple indices), or string[] (object properties)",
									oneOf: [
										{ type: "boolean" },
										{ type: "number" },
										{ items: { type: "number" }, type: "array" },
										{ items: { type: "string" }, type: "array" },
									],
								},
							},
							required: ["name"],
							type: "object",
						},
						type: "array",
					},
					reportMissingDependenciesArray: {
						default: true,
						description: "Report when the dependencies array is completely missing",
						type: "boolean",
					},
					reportUnnecessaryDependencies: {
						default: true,
						description: "Report when unnecessary dependencies are specified",
						type: "boolean",
					},
					reportUnnecessaryStableDependencies: {
						default: false,
						description:
							"Report when stable values (useRef, useState setter, etc.) are included as dependencies",
						type: "boolean",
					},
					resolveExpressionDependencies: {
						default: true,
						description:
							"Recognize expression dependencies like `value !== undefined` as covering a capture",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default useExhaustiveDependencies;
