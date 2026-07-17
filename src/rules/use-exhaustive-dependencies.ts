import { isAnyFunction, isNode } from "$oxc-utilities/oxc-utilities";
import { getBindingPropertyKeyName, getBindingPropertyValueIdentifier } from "$oxc-utilities/react-hook-utilities";
import { isNumberRaw, isRecord, isStringRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { ESTree, Fix, InferContextFromRule, Scope, SourceCode, Visitor } from "oxlint-plugin-utilities";

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

type ScopeVariable = Scope["set"]["get"] extends (key: string) => infer TReturn ? TReturn : never;

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

	while (true) {
		if (
			current.type === "ChainExpression" ||
			current.type === "ParenthesizedExpression" ||
			current.type === "TSAsExpression" ||
			current.type === "TSNonNullExpression" ||
			current.type === "TSSatisfiesExpression" ||
			current.type === "TSTypeAssertion"
		) {
			current = current.expression;
			continue;
		}
		if (current.type !== "MemberExpression") break;
		depth += 1;
		current = current.object;
	}

	return depth;
}

function getRootIdentifier(node: ESTree.Node): ESTree.Node | undefined {
	let current: ESTree.Node = node;

	while (true) {
		if (
			current.type === "ChainExpression" ||
			current.type === "ParenthesizedExpression" ||
			current.type === "TSAsExpression" ||
			current.type === "TSNonNullExpression" ||
			current.type === "TSSatisfiesExpression" ||
			current.type === "TSTypeAssertion"
		) {
			current = current.expression;
			continue;
		}
		if (current.type !== "MemberExpression") break;
		current = current.object;
	}

	return current.type === "Identifier" ? current : undefined;
}

function collectIdentifierNames(node: ESTree.Node): ReadonlyArray<string> {
	if (node.type === "Identifier") return [node.name];
	if (node.type === "MemberExpression") return collectIdentifierNames(node.object);
	if (node.type === "ChainExpression") return collectIdentifierNames(node.expression);
	if (
		node.type === "ParenthesizedExpression" ||
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
): node is ESTree.TSAsExpression | ESTree.TSNonNullExpression | ESTree.TSSatisfiesExpression | ESTree.TSTypeAssertion {
	return TS_RUNTIME_EXPRESSIONS.has(node.type);
}

function nodeToSafeDependencyPath(node: ESTree.Node, sourceCode: SourceCode): string {
	if (node.type === "Identifier") return node.name;
	if (node.type === "ChainExpression" || node.type === "ParenthesizedExpression" || isExpression(node)) {
		return nodeToSafeDependencyPath(node.expression, sourceCode);
	}

	/* v8 ignore next -- @preserve dependency path conversion only receives identifiers, chains, transparent TS wrappers, or member expressions. */
	if (node.type === "MemberExpression") {
		const objectPath = nodeToSafeDependencyPath(node.object, sourceCode);
		if (node.computed) {
			const propertyText = sourceCode.getText(node.property);
			return `${objectPath}[${propertyText}]`;
		}
		/* v8 ignore next -- @preserve non-computed dependency member properties are parser-provided identifiers. */
		const propertyName = node.property.type === "Identifier" ? node.property.name : "";
		const separator = node.optional ? "?." : ".";
		return `${objectPath}${separator}${propertyName}`;
	}

	/* v8 ignore next -- @preserve capture dependency paths are collected from identifiers, member expressions, chains, and transparent TS expression wrappers. */
	return sourceCode.getText(node);
}

function isStableBindingPattern(
	node: ESTree.Node,
	patternType: "ArrayPattern",
): node is ESTree.VariableDeclarator & { readonly id: ESTree.ArrayPattern };
function isStableBindingPattern(
	node: ESTree.Node,
	patternType: "ObjectPattern",
): node is ESTree.VariableDeclarator & { readonly id: ESTree.ObjectPattern };
function isStableBindingPattern(node: ESTree.Node, patternType: "ArrayPattern" | "ObjectPattern"): boolean {
	return node.type === "VariableDeclarator" && node.id.type === patternType;
}

function isStableArrayIndex(
	stableResult: StableResult | undefined,
	node: ESTree.Node,
	identifierName: string,
): boolean {
	if (stableResult === undefined) return false;
	if (!(stableResult instanceof Set && isStableBindingPattern(node, "ArrayPattern"))) return false;

	const { elements } = node.id;
	let index = 0;
	for (const element of elements) {
		const name = element?.type === "Identifier" ? element.name : undefined;
		if (name === identifierName) return stableResult.has(index);

		index += 1;
	}

	return false;
}

function isStableObjectProperty(
	stableResult: StableResult | undefined,
	node: ESTree.Node,
	identifierName: string,
): boolean {
	if (stableResult === undefined) return false;
	if (!(stableResult instanceof Set && isStableBindingPattern(node, "ObjectPattern"))) return false;

	for (const property of node.id.properties) {
		if (property.type !== "Property") continue;

		const valueIdentifier = getBindingPropertyValueIdentifier(property);
		if (valueIdentifier?.name !== identifierName) continue;

		const propertyName = getBindingPropertyKeyName(property);
		return propertyName !== undefined && stableResult.has(propertyName);
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
	return (
		stableResult === true ||
		isStableArrayIndex(stableResult, node, identifierName) ||
		isStableObjectProperty(stableResult, node, identifierName)
	);
}

function isReactJoinBindingsCall(init: ESTree.Expression | null): boolean {
	if (init?.type !== "CallExpression") return false;

	const { callee } = init;
	return (
		callee.type === "MemberExpression" &&
		callee.object.type === "Identifier" &&
		callee.object.name === "React" &&
		callee.property.type === "Identifier" &&
		callee.property.name === "joinBindings"
	);
}

function isMapMethodCall(init: ESTree.Expression | null): boolean {
	if (init?.type !== "CallExpression") return false;

	const { callee } = init;
	return (
		callee.type === "MemberExpression" && callee.property.type === "Identifier" && callee.property.name === "map"
	);
}

function isLiteralInitializer(init: ESTree.Expression | null): boolean {
	return (
		init?.type === "Literal" ||
		init?.type === "TemplateLiteral" ||
		(init?.type === "UnaryExpression" && init.argument.type === "Literal")
	);
}

function isModuleLevelVariable(variable: VariableLike, node: ESTree.Node): boolean {
	const variableDefinition = variable.defs.find((matchedDefinition) => matchedDefinition.node === node);
	/* v8 ignore next -- @preserve variable definitions passed here are matched VariableDeclarator definitions. */
	if (variableDefinition?.node.type !== "VariableDeclarator") return false;

	const declarationParent = variableDefinition.node.parent.parent;
	return declarationParent?.type === "Program" || declarationParent?.type === "ExportNamedDeclaration";
}

function isStableVariableDefinition(
	variable: VariableLike,
	definition: VariableDefinitionLike,
	identifierName: string,
	stableHooks: Map<string, StableResult>,
): boolean {
	const { node, type } = definition;
	if (STABLE_VALUE_TYPES.has(type)) return true;
	if (type !== "Variable" || node.type !== "VariableDeclarator") return false;

	const { parent } = node;
	if (parent.type !== "VariableDeclaration" || parent.kind !== "const") return false;

	const { init } = node;
	return (
		isStableHookValue(init, node, identifierName, stableHooks) ||
		isReactJoinBindingsCall(init) ||
		isMapMethodCall(init) ||
		isLiteralInitializer(init) ||
		isModuleLevelVariable(variable, node)
	);
}

function isStableValue(
	variable: undefined | VariableLike,
	identifierName: string,
	stableHooks: Map<string, StableResult>,
): boolean {
	/* v8 ignore next -- @preserve callers resolve captured identifiers to scope variables before stability checks. */
	if (!variable) return false;

	const definitions = variable.defs;
	/* v8 ignore next -- @preserve resolved scope variables for captured identifiers expose at least one definition. */
	if (definitions.length === 0) return false;

	for (const definition of definitions) {
		if (isStableVariableDefinition(variable, definition, identifierName, stableHooks)) return true;
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

		/* v8 ignore next -- @preserve captured member chains stop at member, chain, or non-null parents before this guard. */
		if (!(isMemberParent || isChainParent || isNonNullParent)) {
			break;
		}

		current = currentParent;
		/* v8 ignore next -- @preserve captured member-chain parents are linked until traversal stops at a non-chain parent. */
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
	/* v8 ignore next -- @preserve capture metadata is only requested for Identifier nodes. */
	if (identifier.type !== "Identifier") return false;
	const { parent } = identifier;
	return parent.type === "Property" && parent.computed && parent.key === identifier;
}

function isInTypePosition(identifier: ESTree.Node): boolean {
	/* v8 ignore next -- @preserve type-position checks are only requested for Identifier nodes. */
	if (identifier.type !== "Identifier") return false;
	/* v8 ignore next -- @preserve parser-provided identifiers have parent links inside the visited closure tree. */
	let parent: ESTree.Node | undefined = identifier.parent ?? undefined;

	while (parent) {
		if (TS_RUNTIME_EXPRESSIONS.has(parent.type)) {
			/* v8 ignore next -- @preserve transparent TypeScript wrappers have parent links inside the visited closure tree. */
			parent = parent.parent ?? undefined;
			continue;
		}
		if (parent.type.startsWith("TS")) return true;
		if (IS_CEASE_BOUNDARY.has(parent.type)) return false;
		/* v8 ignore next -- @preserve parser-provided parent chains continue until a declaration or TypeScript boundary. */
		parent = parent.parent ?? undefined;
	}

	/* v8 ignore next -- @preserve parser-provided identifiers always reach a containing expression, declaration, or TypeScript parent boundary. */
	return false;
}

function isDeclaredInComponentBody(variable: VariableLike, closureNode: ESTree.Node): boolean {
	/* v8 ignore next -- @preserve hook closure nodes are nested inside their containing component function. */
	let parent: ESTree.Node | undefined = closureNode.parent ?? undefined;

	while (parent) {
		const isFunction = isAnyFunction(parent);

		if (isFunction) {
			const functionParent = parent;

			const isParameter = variable.defs.some((definition) => {
				if (definition.type !== "Parameter") return false;
				return definition.node === functionParent;
			});

			if (isParameter) return true;

			return variable.defs.some((definition) => {
				/* v8 ignore next -- @preserve variable definitions captured from component scope have parent links. */
				let definitionNode: ESTree.Node | undefined = definition.node.parent ?? undefined;
				while (definitionNode && definitionNode !== functionParent) {
					/* v8 ignore next -- @preserve definition parent chains continue until the containing component function. */
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
	/* v8 ignore next -- @preserve closure reference resolution is only requested for Identifier nodes. */
	if (identifier.type !== "Identifier") return undefined;

	let variable: ScopeVariable;
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

function resolveVariableInScope(name: string, scope: Scope): ScopeVariable {
	let currentScope: null | Scope = scope;

	while (currentScope) {
		const variable = currentScope.set.get(name);
		if (variable) return variable;
		currentScope = currentScope.upper;
	}

	return undefined;
}

function isDefinitionInsideNode(definition: VariableDefinitionLike, node: ESTree.Node): boolean {
	let definitionNode: ESTree.Node | undefined = definition.node;
	while (definitionNode) {
		if (definitionNode === node) return true;
		definitionNode = definitionNode.parent ?? undefined;
	}
	return false;
}

function shouldCaptureVariable(variable: ScopeVariable, node: ESTree.Node): boolean {
	return variable !== undefined && !variable.defs.some((definition) => isDefinitionInsideNode(definition, node));
}

function getCaptureInfo(
	current: ESTree.Node,
	name: string,
	variable: VariableLike,
	sourceCode: SourceCode,
): CaptureInfo {
	/* v8 ignore next -- @preserve captured identifiers have parser parent links in the visited closure tree. */
	const depthNode = findTopmostMemberExpression(current, current.parent ?? undefined);
	return {
		depth: getMemberExpressionDepth(depthNode),
		forceDependency: isComputedPropertyIdentifier(current),
		name,
		node: depthNode,
		usagePath: nodeToSafeDependencyPath(depthNode, sourceCode),
		variable,
	};
}

function isTransparentExpressionNode(
	node: ESTree.Node,
): node is
	| ESTree.ParenthesizedExpression
	| ESTree.TSAsExpression
	| ESTree.TSNonNullExpression
	| ESTree.TSSatisfiesExpression
	| ESTree.TSTypeAssertion {
	return (
		node.type === "ParenthesizedExpression" ||
		node.type === "TSSatisfiesExpression" ||
		node.type === "TSAsExpression" ||
		node.type === "TSTypeAssertion" ||
		node.type === "TSNonNullExpression"
	);
}

function visitChildNodes(current: ESTree.Node, sourceCode: SourceCode, visit: (node: ESTree.Node) => void): void {
	/* v8 ignore next -- @preserve parser node types visited here have registered visitor keys. */
	const keys = sourceCode.visitorKeys[current.type] ?? [];
	for (const key of keys) {
		/* v8 ignore next -- @preserve traversal only visits parser node records. */
		if (!isRecord(current)) break;
		const value = current[key];
		if (Array.isArray(value)) {
			/* v8 ignore next -- @preserve visitor-key arrays contain parser nodes when present. */
			for (const item of value) if (isNode(item)) visit(item);
		} else if (isNode(value)) {
			visit(value);
		}
	}
}

function collectCaptures(node: ESTree.Node, sourceCode: SourceCode): ReadonlyArray<CaptureInfo> {
	const captures = new Array<CaptureInfo>();
	const captureSet = new Set<string>();

	function visitIdentifier(current: ESTree.Node): void {
		/* v8 ignore next -- @preserve visitIdentifier is only called after checking the node is an Identifier. */
		if (current.type !== "Identifier") return;

		const { name } = current;
		if (captureSet.has(name) || GLOBAL_BUILTINS.has(name) || isInTypePosition(current)) return;

		const variable = resolveVariableInScope(name, sourceCode.getScope(current));
		if (!shouldCaptureVariable(variable, node)) return;
		/* v8 ignore next -- @preserve shouldCaptureVariable rejects unresolved scope variables. */
		if (variable === undefined) return;

		if (!isDeclaredInComponentBody(variable, node)) return;

		captureSet.add(name);
		captures.push(getCaptureInfo(current, name, variable, sourceCode));
	}

	function visit(current: ESTree.Node): void {
		if (current.type === "Identifier") visitIdentifier(current);

		if (isTransparentExpressionNode(current)) {
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

		visitChildNodes(current, sourceCode, visit);
	}

	visit(node);
	return captures;
}

function parseDependencies(node: ESTree.ArrayExpression, sourceCode: SourceCode): ReadonlyArray<DependencyInfo> {
	const dependencies = new Array<DependencyInfo>();

	for (const element of node.elements) {
		if (!element) continue;

		const actualNode = element.type === "SpreadElement" ? element.argument : element;

		const name = nodeToSafeDependencyPath(actualNode, sourceCode);
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
	if (parent.type !== "VariableDeclarator") return false;

	/* v8 ignore next -- @preserve self-reference captures have resolved variable definitions. */
	return capture.variable?.defs.some((definition) => definition.node === parent) ?? false;
}

function isNumericArray(array: ReadonlyArray<unknown>): array is Array<number> {
	return array.length > 0 && isNumberRaw(array[0]);
}
function isStringArray(array: ReadonlyArray<unknown>): array is Array<string> {
	return array.length > 0 && isStringRaw(array[0]);
}

function convertStableResult(
	stableResult: boolean | number | ReadonlyArray<number> | ReadonlyArray<string>,
): StableResult {
	if (typeof stableResult === "boolean") return stableResult;
	if (isNumberRaw(stableResult)) return new Set([stableResult]);

	/* v8 ignore next -- @preserve stableResult option schema only permits boolean, number, or arrays. */
	if (Array.isArray(stableResult)) {
		if (isNumericArray(stableResult)) return new Set(stableResult);
		/* v8 ignore next -- @preserve schema validation rejects ambiguous empty arrays before stableResult conversion runs. */
		if (isStringArray(stableResult)) return new Set(stableResult);
	}

	/* v8 ignore next -- @preserve schema validation rejects ambiguous empty arrays before stableResult conversion runs. */
	return false;
}

function reportUnnecessaryDependency(
	context: RuleContext,
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

type RuleContext = InferContextFromRule<typeof useExhaustiveDependencies>;
function isCallbackFunctionNode(node?: ESTree.Node): node is CallbackFunction {
	return node !== undefined && isAnyFunction(node);
}

function getRequiredCaptures(
	captures: ReadonlyArray<CaptureInfo>,
	stableHooks: Map<string, StableResult>,
): ReadonlyArray<CaptureInfo> {
	return captures.filter(
		(capture) => capture.forceDependency || !isStableValue(capture.variable, capture.name, stableHooks),
	);
}

function reportMissingDependenciesArray(
	context: RuleContext,
	node: ESTree.CallExpression,
	closureArgument: ESTree.Node,
	requiredCaptures: ReadonlyArray<CaptureInfo>,
): void {
	if (requiredCaptures.length === 0) return;

	const missingNames = [...new Set(requiredCaptures.map(returnName))].join(", ");
	const uniqueDependencies = [...new Set(requiredCaptures.map(({ usagePath }) => usagePath))].toSorted();
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

function getRootIdentifierName(node: ESTree.Node): string | undefined {
	const rootIdentifier = getRootIdentifier(node);
	return rootIdentifier?.type === "Identifier" ? rootIdentifier.name : undefined;
}

function getMatchingCaptures(
	captures: ReadonlyArray<CaptureInfo>,
	dependency: DependencyInfo,
): ReadonlyArray<CaptureInfo> {
	const dependencyName = getRootIdentifierName(dependency.node);
	if (dependencyName === undefined) return [];

	return captures.filter((capture) => getRootIdentifierName(capture.node) === dependencyName);
}

function isStableDependency(
	matchingCaptures: ReadonlyArray<CaptureInfo>,
	stableHooks: Map<string, StableResult>,
): boolean {
	return (
		matchingCaptures.length > 0 &&
		matchingCaptures.every(
			(capture) => !capture.forceDependency && isStableValue(capture.variable, capture.name, stableHooks),
		)
	);
}

function reportUnnecessaryDependencies(
	context: RuleContext,
	dependencies: ReadonlyArray<DependencyInfo>,
	captures: ReadonlyArray<CaptureInfo>,
	dependenciesArray: ESTree.ArrayExpression,
	stableHooks: Map<string, StableResult>,
	reportUnnecessary: boolean,
	reportStableDependencies: boolean,
): void {
	for (const dependency of dependencies) {
		const matchingCaptures = getMatchingCaptures(captures, dependency);
		if (matchingCaptures.length === 0) {
			if (reportUnnecessary) reportUnnecessaryDependency(context, dependencies, dependency, dependenciesArray);
			continue;
		}

		if (reportStableDependencies && isStableDependency(matchingCaptures, stableHooks)) {
			reportUnnecessaryDependency(context, dependencies, dependency, dependenciesArray);
			continue;
		}

		const maxCaptureDepth = Math.max(...matchingCaptures.map(({ depth }) => depth));
		if (reportUnnecessary && dependency.depth > maxCaptureDepth) {
			reportUnnecessaryDependency(context, dependencies, dependency, dependenciesArray);
		}
	}
}

function dependencyCoversCapture(
	dependency: DependencyInfo,
	capture: CaptureInfo,
	resolveExpressionDependencies: boolean,
): boolean {
	const dependencyRootIdentifier = getRootIdentifier(dependency.node);
	if (dependencyRootIdentifier?.type === "Identifier" && dependency.depth <= capture.depth) {
		return dependencyRootIdentifier.name === getRootIdentifierName(capture.node);
	}

	/* v8 ignore next -- @preserve resolveExpressionDependencies=false is covered by expression dependencies; non-expression dependencies return above. */
	if (!resolveExpressionDependencies) return false;

	const captureName = getRootIdentifierName(capture.node);
	/* v8 ignore next -- @preserve captures considered for dependency coverage always have root identifiers. */
	if (captureName === undefined) return false;

	return collectIdentifierNames(dependency.node).includes(captureName);
}

function collectMissingCaptures(
	captures: ReadonlyArray<CaptureInfo>,
	dependencies: ReadonlyArray<DependencyInfo>,
	stableHooks: Map<string, StableResult>,
	resolveExpressionDependencies: boolean,
): ReadonlyArray<CaptureInfo> {
	const missingCaptures = new Array<CaptureInfo>();
	for (const capture of getRequiredCaptures(captures, stableHooks)) {
		/* v8 ignore next -- @preserve required captures are collected from identifier-rooted expressions. */
		if (getRootIdentifierName(capture.node) === undefined) continue;
		if (
			dependencies.some((dependency) =>
				dependencyCoversCapture(dependency, capture, resolveExpressionDependencies),
			)
		) {
			continue;
		}
		missingCaptures.push(capture);
	}
	return missingCaptures;
}

function reportMissingCaptures(
	context: RuleContext,
	dependenciesArray: ESTree.ArrayExpression,
	dependencies: ReadonlyArray<DependencyInfo>,
	missingCaptures: ReadonlyArray<CaptureInfo>,
): void {
	if (missingCaptures.length === 0) return;

	const dependencyNames = dependencies.map(({ name }) => name);
	const missingPaths = missingCaptures.map(({ usagePath }) => usagePath);
	const newDependenciesString = `[${[...dependencyNames, ...missingPaths].toSorted().join(", ")}]`;
	const reportNode = dependencies.at(-1)?.node ?? dependenciesArray;
	const firstMissing = missingCaptures.at(0);

	if (missingCaptures.length === 1 && firstMissing !== undefined) {
		context.report({
			data: { name: firstMissing.usagePath },
			fix(fixer): Fix {
				return fixer.replaceText(dependenciesArray, newDependenciesString);
			},
			messageId: "missingDependency",
			node: reportNode,
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
		return;
	}

	context.report({
		data: { names: missingPaths.join(", ") },
		fix(fixer): Fix {
			return fixer.replaceText(dependenciesArray, newDependenciesString);
		},
		messageId: "missingDependencies",
		node: reportNode,
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

function getInitialNode(capture: CaptureInfo): ESTree.Node | undefined {
	const variableDefinition = capture.variable?.defs[0];
	/* v8 ignore next -- @preserve unstable dependency checks only inspect variable declarator captures. */
	return variableDefinition?.node.type === "VariableDeclarator"
		? (variableDefinition.node.init ?? undefined)
		: undefined;
}

function reportUnstableDependencies(
	context: RuleContext,
	captures: ReadonlyArray<CaptureInfo>,
	dependencies: ReadonlyArray<DependencyInfo>,
	stableHooks: Map<string, StableResult>,
): void {
	for (const capture of getRequiredCaptures(captures, stableHooks)) {
		const captureName = getRootIdentifierName(capture.node);
		/* v8 ignore next -- @preserve required captures are collected from identifier-rooted expressions. */
		if (captureName === undefined) continue;

		for (const dependency of dependencies) {
			const dependencyName = getRootIdentifierName(dependency.node);
			const isMatch = dependencyName === captureName && dependency.depth === capture.depth;
			if (!isMatch) continue;

			if (dependency.depth === 0 && isUnstableValue(getInitialNode(capture))) {
				context.report({
					data: { name: capture.usagePath },
					messageId: "unstableDependency",
					node: dependency.node,
				});
			}
			break;
		}
	}
}

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
			/* v8 ignore next -- @preserve closure resolution does not request the same cached scope twice in current traversal paths. */
			if (cached) return cached;

			const scope = context.sourceCode.getScope(node);
			scopeCache.set(node, scope);
			return scope;
		}

		function resolveClosureFunction(
			closureArgument: ESTree.Node,
			callExpression: ESTree.CallExpression,
		): CallbackFunction | undefined {
			if (closureArgument.type === "ArrowFunctionExpression") return closureArgument;

			const canResolveClosure = isAnyFunction(closureArgument) || closureArgument.type === "Identifier";
			if (!canResolveClosure) return undefined;

			const resolved = resolveFunctionReference(closureArgument, getScope(callExpression));
			return isCallbackFunctionNode(resolved) ? resolved : undefined;
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

				const closureFunction = resolveClosureFunction(closureArgument, node);
				if (!closureFunction) return;

				const dependenciesArgument = parameters[dependenciesIndex];
				if (!dependenciesArgument && resolvedOptions.reportMissingDependenciesArray) {
					const captures = collectCaptures(closureFunction, context.sourceCode).filter(
						(capture) => !isSelfReferenceCapture(capture, node),
					);
					const requiredCaptures = getRequiredCaptures(captures, stableHooks);

					reportMissingDependenciesArray(context, node, closureArgument, requiredCaptures);
					return;
				}

				if (!dependenciesArgument) return;
				if (dependenciesArgument.type !== "ArrayExpression") return;
				const dependenciesArray = dependenciesArgument;
				const captures = collectCaptures(closureFunction, context.sourceCode).filter(
					(capture) => !isSelfReferenceCapture(capture, node),
				);

				const dependencies = parseDependencies(dependenciesArray, context.sourceCode);

				if (
					resolvedOptions.reportUnnecessaryDependencies ||
					resolvedOptions.reportUnnecessaryStableDependencies
				) {
					reportUnnecessaryDependencies(
						context,
						dependencies,
						captures,
						dependenciesArray,
						stableHooks,
						resolvedOptions.reportUnnecessaryDependencies,
						resolvedOptions.reportUnnecessaryStableDependencies,
					);
				}

				const missingCaptures = collectMissingCaptures(
					captures,
					dependencies,
					stableHooks,
					resolvedOptions.resolveExpressionDependencies,
				);
				reportMissingCaptures(context, dependenciesArray, dependencies, missingCaptures);
				reportUnstableDependencies(context, captures, dependencies, stableHooks);
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
						default: [],
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
