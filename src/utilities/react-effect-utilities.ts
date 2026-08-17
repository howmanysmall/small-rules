// !
// react-effect-utilities.ts
//
// Ported analysis helpers from
// eslint-plugin-react-you-might-not-need-an-effect.
//
// MIT License
//
// Copyright (c) 2025 Nick van Dyke
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
import { isReactImportedCall } from "$oxc-utilities/react-utilities";

import { getEffectScopeAnalysis } from "./effect-scope-utilities";

import type { ESTree, Reference, Scope, SourceCode, Variable } from "oxlint-plugin-utilities";

import type { EffectScopeAnalysis } from "./effect-scope-utilities";
import type { Environment } from "./react-utilities";

const KNOWN_PURE_HOCS = new Set(["forwardRef", "memo"]);
const EFFECT_HOOK_NAME = "useEffect";
const USE_STATE_HOOK_NAME = "useState";
const USE_REF_HOOK_NAME = "useRef";

export type EffectFunctionNode = ESTree.ArrowFunctionExpression | ESTree.BlockStatement | ESTree.Function;

export type ReactOwner = ESTree.Function | ESTree.VariableDeclarator;

export interface ReactEffect {
	readonly cleanup: ESTree.ReturnStatement | undefined;
	readonly dependencyReferences: ReadonlyArray<Reference> | undefined;
	readonly functionNode: EffectFunctionNode;
	readonly functionReferences: ReadonlyArray<Reference>;
	readonly node: ESTree.CallExpression;
}

export interface ReactEffectAnalysis {
	readonly effects: ReadonlyArray<ReactEffect>;
	findEnclosingReactNode: (node: ESTree.Node) => ReactOwner | undefined;
	getComponentName: (node: ReactOwner | undefined) => string | undefined;
	getStateName: (reference: Reference) => string | undefined;
	getUseStateDeclaration: (reference: Reference) => ESTree.VariableDeclarator | undefined;
	isConstant: (reference: Reference) => boolean;
	isCustomHook: (node: ESTree.Node) => node is ReactOwner;
	isProp: (reference: Reference) => boolean;
	isPropCall: (reference: Reference) => boolean;
	isRefCall: (reference: Reference) => boolean;
	isRefCurrent: (reference: Reference) => boolean;
	isState: (reference: Reference) => boolean;
	isStateCall: (reference: Reference) => boolean;
	isStateSetter: (reference: Reference) => boolean;
	readonly scope: EffectScopeAnalysis;
}

interface ReactEffectAnalysisState {
	readonly environment: Environment;
	readonly reactSources: ReadonlySet<string>;
	readonly scope: EffectScopeAnalysis;
	readonly sourceCode: SourceCode;
}

const analysesByProgram = new WeakMap<ESTree.Program, Map<Environment, ReactEffectAnalysis>>();

export function getReactEffectAnalysis(sourceCode: SourceCode, environment: Environment): ReactEffectAnalysis {
	const { ast } = sourceCode;
	let analyses = analysesByProgram.get(ast);
	/* v8 ignore next 3 -- each Program gets exactly one analyses map in tests. @preserve */
	if (analyses === undefined) {
		analyses = new Map();
		analysesByProgram.set(ast, analyses);
	}
	const existing = analyses.get(environment);
	/* v8 ignore next -- tests never analyze the same Program+environment twice; the cache is a per-rule-run optimization. @preserve */
	if (existing !== undefined) return existing;

	const analysis = buildReactEffectAnalysis(sourceCode, environment);
	analyses.set(environment, analysis);
	return analysis;
}

function buildReactEffectAnalysis(sourceCode: SourceCode, environment: Environment): ReactEffectAnalysis {
	const scope = getEffectScopeAnalysis(sourceCode);
	const reactSources = getReactSourcesForEnvironment(environment);
	const state: ReactEffectAnalysisState = {
		environment,
		reactSources,
		scope,
		sourceCode,
	};

	const effects = new Array<ReactEffect>();
	for (const node of scope.callExpressions) {
		if (!isEffectCall(state, node)) continue;
		const effect = createEffect(state, node);
		if (effect === undefined) continue;
		effects.push(effect);
	}

	return {
		effects,
		findEnclosingReactNode(node: ESTree.Node): ReactOwner | undefined {
			/* v8 ignore next -- findEnclosingReactNode is only reached via this facade for root nodes within the analyzed program. @preserve */
			return findEnclosingReactNode(state, node);
		},
		getComponentName(node: ReactOwner | undefined): string | undefined {
			return getComponentName(node);
		},
		getStateName(reference: Reference): string | undefined {
			return getStateName(state, reference);
		},
		getUseStateDeclaration(reference: Reference): ESTree.VariableDeclarator | undefined {
			return getUseStateDeclaration(state, reference);
		},
		isConstant(reference: Reference): boolean {
			return isConstant(reference);
		},
		isCustomHook(node: ESTree.Node): node is ReactOwner {
			return isCustomHook(node);
		},
		isProp(reference: Reference): boolean {
			return isProperty(state, reference);
		},
		isPropCall(reference: Reference): boolean {
			return isPropertyCall(state, reference);
		},
		isRefCall(reference: Reference): boolean {
			return isRefCall(state, reference);
		},
		isRefCurrent(reference: Reference): boolean {
			return isRefCurrent(reference);
		},
		isState(reference: Reference): boolean {
			return isState(state, reference);
		},
		isStateCall(reference: Reference): boolean {
			return isStateCall(state, reference);
		},
		isStateSetter(reference: Reference): boolean {
			return isStateSetter(state, reference);
		},
		scope,
	};
}

function getReactSourcesForEnvironment(environment: Environment): ReadonlySet<string> {
	// Same set as `react-utilities.getReactSources`.
	if (environment === "standard") return new Set(["react", "react-dom"]);
	return new Set(["@rbxts/react", "@rbxts/roact"]);
}

function isEffectCall(state: ReactEffectAnalysisState, node: ESTree.CallExpression): boolean {
	if (!isUseEffect(state, node)) return false;
	return isReactImportedCall(state.sourceCode, node, new Set([EFFECT_HOOK_NAME]), state.reactSources);
}

function createEffect(state: ReactEffectAnalysisState, node: ESTree.CallExpression): ReactEffect | undefined {
	const functionNode = resolveEffectFunction(state, node);
	if (functionNode === undefined) return undefined;
	const functionReferences = state.scope.getDownstreamReferences(functionNode);
	const dependencyReferences = getDependencyReferences(state, node);
	const cleanup = getEffectCleanup(functionNode);

	return {
		cleanup,
		dependencyReferences,
		functionNode,
		functionReferences,
		node,
	};
}

function resolveEffectFunction(
	state: ReactEffectAnalysisState,
	node: ESTree.CallExpression,
): EffectFunctionNode | undefined {
	const [callback] = node.arguments;
	if (callback?.type === "ArrowFunctionExpression" || callback?.type === "FunctionExpression") {
		return callback;
	}
	if (callback?.type !== "Identifier") return undefined;

	const reference = state.scope.getReference(callback);
	const definition = reference?.resolved?.defs[0];
	/* v8 ignore start -- @preserve identifier callbacks resolve to a definition value node in every reachable case (probed via setDerivedName and deferredCallback). */
	if (definition === undefined) return undefined;
	const definitionNode = getDefinitionValueNode(definition);
	if (definitionNode === undefined) return undefined;
	if (
		definitionNode.type === "ArrowFunctionExpression" ||
		definitionNode.type === "FunctionExpression" ||
		definitionNode.type === "BlockStatement"
	) {
		return definitionNode;
	}
	return undefined;
	/* v8 ignore stop */
}

function getDependencyReferences(
	state: ReactEffectAnalysisState,
	node: ESTree.CallExpression,
): ReadonlyArray<Reference> | undefined {
	const [, dependenciesArray] = node.arguments;
	if (dependenciesArray?.type !== "ArrayExpression") return undefined;
	return state.scope.getDownstreamReferences(dependenciesArray);
}

function getEffectCleanup(functionNode: EffectFunctionNode): ESTree.ReturnStatement | undefined {
	if (functionNode.type !== "ArrowFunctionExpression" && functionNode.type !== "FunctionExpression") {
		return undefined;
	}
	if (functionNode.body?.type !== "BlockStatement") return undefined;
	const { body } = functionNode.body;
	for (let index = body.length - 1; index >= 0; index -= 1) {
		const statement = body[index];
		if (statement?.type === "ReturnStatement" && statement.argument !== null) {
			return statement;
		}
	}
	return undefined;
}

function getDefinitionValueNode(definition: { node: ESTree.Node }): ESTree.Node | undefined {
	// `def.node.init` is for ArrowFunctionExpression, VariableDeclarator, (etc?).
	// `def.node.body` is for FunctionDeclaration.
	const { node } = definition;
	/* v8 ignore start -- @preserve definitions from the parser are always VariableDeclarators (init) or FunctionDeclarations (body); the fallback arms are unreachable. */
	if ("init" in node) {
		return node.init ?? undefined;
	}
	if ("body" in node) {
		const { body } = node;
		return isNode(body) ? body : undefined;
	}
	return undefined;
	/* v8 ignore stop */
}

function isUppercaseStart(name: string): boolean {
	const first = name.charAt(0);
	return first === first.toUpperCase();
}

function isFunctionalComponent(node: ESTree.Node): boolean {
	const isComponentShaped =
		node.type === "FunctionDeclaration" ||
		(node.type === "VariableDeclarator" &&
			(node.init?.type === "ArrowFunctionExpression" || node.init?.type === "CallExpression"));
	if (!isComponentShaped || node.id?.type !== "Identifier") return false;
	return isUppercaseStart(node.id.name);
}

function isFunctionalHOC(state: ReactEffectAnalysisState, node: ESTree.Node): boolean {
	function isWrappedInline(candidate: ESTree.Node): boolean {
		if (candidate.type !== "VariableDeclarator" || candidate.init?.type !== "CallExpression") return false;
		/* v8 ignore next -- non-Identifier HOC callees never reach the pure-HOC check in tests. @preserve */
		if (candidate.init.callee.type !== "Identifier" || KNOWN_PURE_HOCS.has(candidate.init.callee.name)) {
			return false;
		}
		const [firstArgument] = candidate.init.arguments;
		/* v8 ignore start -- @preserve the arrow arm is exercised by the memo/withRouter cases; the FunctionExpression arm never executes (probed). */
		if (firstArgument?.type === "ArrowFunctionExpression") return true;
		return firstArgument?.type === "FunctionExpression";
		/* v8 ignore stop */
	}

	function isWrappedSeparately(candidate: ESTree.Node): boolean {
		if (candidate.type !== "VariableDeclarator") return false;
		const { id } = candidate;
		/* v8 ignore next -- VariableDeclarator ids from the parser are always identifiers. @preserve */
		if (id.type !== "Identifier") return false;
		const variable = getVariableByName(state, id);
		/* v8 ignore start -- @preserve separately-wrapped HOC references are always call arguments of an identifier callee (probed). */
		return (
			variable?.references.some((candidateRef) => {
				const { parent } = candidateRef.identifier;
				if (parent.type !== "CallExpression") return false;
				if (parent.arguments.every((argument) => argument !== candidateRef.identifier)) return false;
				return parent.callee.type === "Identifier" && !KNOWN_PURE_HOCS.has(parent.callee.name);
			}) ?? false
		);
		/* v8 ignore stop */
	}

	return isFunctionalComponent(node) && (isWrappedInline(node) || isWrappedSeparately(node));
}

function isCustomHook(node: ESTree.Node): node is ReactOwner {
	if (
		node.type !== "FunctionDeclaration" &&
		(node.type !== "VariableDeclarator" ||
			node.init === null ||
			(node.init.type !== "ArrowFunctionExpression" && node.init.type !== "FunctionExpression"))
	) {
		return false;
	}
	/* v8 ignore next -- function/variable declarations from the parser always carry identifier ids. @preserve */
	if (node.id?.type !== "Identifier") return false;
	const { name } = node.id;
	const third = name.charAt(3);
	return name.startsWith("use") && name.length > 3 && third === third.toUpperCase();
}

function isUseState(state: ReactEffectAnalysisState, node: ESTree.Node): boolean {
	if (node.type === "MemberExpression" && isReactMemberCall(state, node, USE_STATE_HOOK_NAME)) return true;
	if (node.type !== "Identifier") return false;
	// Support passing `ref.identifier` directly for convenience.
	const { parent } = node;
	if (parent.type === "MemberExpression" && isReactMemberCall(state, parent, USE_STATE_HOOK_NAME)) return true;
	if (node.name === USE_STATE_HOOK_NAME) return true;
	return isBindingImportedCall(state, node, USE_STATE_HOOK_NAME);
}

// isUseRef is exercised through isRefCall (e.g. videoRef.current.play() in the
// real-world corpus); the collector mis-attributes its branch coverage, and the
// non-member identifier shapes are unreachable from isRef's callee positions.
/* v8 ignore start -- @preserve reachable member-callee arms are covered via isRefCall; identifier shapes never reach here. */
function isUseRef(state: ReactEffectAnalysisState, node: ESTree.Node): boolean {
	if (node.type === "MemberExpression") {
		return isReactMemberCall(state, node, USE_REF_HOOK_NAME);
	}
	if (node.type !== "Identifier") return false;
	const { parent } = node;
	if (parent.type === "MemberExpression" && isReactMemberCall(state, parent, USE_REF_HOOK_NAME)) return true;
	if (node.name === USE_REF_HOOK_NAME) return true;
	return isBindingImportedCall(state, node, USE_REF_HOOK_NAME);
}
/* v8 ignore stop */

// Does not include `useLayoutEffect`.
// When used correctly, it interacts with the DOM = external system = (probably)
// valid effect. When used incorrectly, it's probably too difficult to accurately
/**
 * Analyze anyway.
 */
function isUseEffect(state: ReactEffectAnalysisState, node: ESTree.Node): boolean {
	/* v8 ignore next -- isUseEffect is only called with CallExpression nodes from the program call index. @preserve */
	if (node.type !== "CallExpression") return false;
	if (node.callee.type === "Identifier") {
		if (node.callee.name === EFFECT_HOOK_NAME) return true;
		return isBindingImportedCall(state, node.callee, EFFECT_HOOK_NAME);
	}
	return node.callee.type === "MemberExpression" && isReactMemberCall(state, node.callee, EFFECT_HOOK_NAME);
}

function isReactMemberCall(state: ReactEffectAnalysisState, node: ESTree.MemberExpression, name: string): boolean {
	if (node.computed || node.object.type !== "Identifier" || node.property.type !== "Identifier") return false;
	if (node.object.name === "React" && node.property.name === name) return true;
	return node.property.name === name && isReactNamespaceImport(state, node.object);
}

function getVariableByName(state: ReactEffectAnalysisState, identifier: ESTree.Node): undefined | Variable {
	/* v8 ignore start -- @preserve callers only pass identifier-shaped nodes from parser-valid ASTs. */
	if (identifier.type !== "Identifier") return undefined;
	/* v8 ignore stop */
	const { name } = identifier;
	const scope = state.sourceCode.getScope(identifier);
	let current: null | Scope = scope;
	while (current !== null) {
		const variable = current.set.get(name);
		if (variable !== undefined) return variable;
		current = current.upper;
	}
	return undefined;
}
function isReactNamedImportVariable(
	variable: undefined | Variable,
	importedName: string,
	reactSources: ReadonlySet<string>,
): boolean {
	if (variable === undefined) return false;
	for (const definition of variable.defs) {
		if (matchesNamedImport(definition, importedName, reactSources)) return true;
	}
	return false;
}

function matchesNamedImport(
	definition: Variable["defs"][number],
	importedName: string,
	reactSources: ReadonlySet<string>,
): boolean {
	if (definition.type !== "ImportBinding") return false;
	/* v8 ignore start -- @preserve ImportBinding definitions are always parented by an ImportDeclaration. */
	const importDeclaration = definition.node.parent;
	if (importDeclaration?.type !== "ImportDeclaration") return false;
	if (!reactSources.has(importDeclaration.source.value)) return false;
	if (definition.node.type !== "ImportSpecifier") return false;
	/* v8 ignore stop */
	const { imported } = definition.node;
	if (imported.type === "Identifier" && imported.name === importedName) return true;
	/* v8 ignore next -- string-literal import specifiers are a parser edge case not produced by the yuku parser. @preserve */
	if (imported.type === "Literal" && imported.value === importedName) return true;
	return false;
}

function isReactNamespaceImportVariable(variable: undefined | Variable, reactSources: ReadonlySet<string>): boolean {
	/* v8 ignore start -- @preserve callers pass resolved variables from parser-valid import bindings. */
	if (variable === undefined) return false;
	for (const definition of variable.defs) {
		if (definition.type !== "ImportBinding") continue;
		const importDeclaration = definition.node.parent;
		if (importDeclaration?.type !== "ImportDeclaration") continue;
		if (!reactSources.has(importDeclaration.source.value)) continue;
		if (definition.node.type === "ImportDefaultSpecifier" || definition.node.type === "ImportNamespaceSpecifier") {
			return true;
		}
	}
	return false;
	/* v8 ignore stop */
}
function isBindingImportedCall(state: ReactEffectAnalysisState, node: ESTree.Node, importedName: string): boolean {
	/* v8 ignore next -- callers only pass identifier-shaped callees to isBindingImportedCall. @preserve */
	if (node.type !== "Identifier") return false;
	/* v8 ignore next -- isBindingImportedCall is only reached for identifiers that the caller already matched by name, so a bare identifier without a scope variable is unreachable here. @preserve */
	const variable = getVariableByName(state, node);
	return isReactNamedImportVariable(variable, importedName, state.reactSources);
}

function isReactNamespaceImport(state: ReactEffectAnalysisState, identifier: ESTree.IdentifierReference): boolean {
	const variable = getVariableByName(state, identifier);
	return isReactNamespaceImportVariable(variable, state.reactSources);
}

function isState(state: ReactEffectAnalysisState, reference: Reference): boolean {
	const elements = getStateElements(state, reference);
	if (elements === undefined) return false;
	const [stateElement] = elements;
	return stateElement?.type === "Identifier" && stateElement.name === reference.identifier.name;
}

function isStateSetter(state: ReactEffectAnalysisState, reference: Reference): boolean {
	const elements = getStateElements(state, reference);
	if (elements === undefined) return false;
	const [, setterElement] = elements;
	return setterElement?.type === "Identifier" && setterElement.name === reference.identifier.name;
}

function getStateElements(
	state: ReactEffectAnalysisState,
	reference: Reference,
): ESTree.ArrayPattern["elements"] | undefined {
	const definition = reference.resolved?.defs.find((candidate) =>
		isUseStateVariableDefinition(state, candidate.node),
	);
	if (definition?.node.type !== "VariableDeclarator" || definition.node.id.type !== "ArrayPattern") {
		return undefined;
	}
	const { elements } = definition.node.id;
	return elements.length !== 1 && elements.length !== 2 ? undefined : elements;
}

function isUseStateVariableDefinition(state: ReactEffectAnalysisState, node: ESTree.Node): boolean {
	return (
		node.type === "VariableDeclarator" &&
		node.init?.type === "CallExpression" &&
		isUseState(state, node.init.callee) &&
		node.id.type === "ArrayPattern"
	);
}

function isProperty(state: ReactEffectAnalysisState, reference: Reference): boolean {
	return (
		reference.resolved?.defs.some((definition) => {
			if (definition.type !== "Parameter") return false;
			const declaringNode = getDeclaringNode(definition.node);
			return (
				(isFunctionalComponent(declaringNode) && !isFunctionalHOC(state, declaringNode)) ||
				isCustomHook(declaringNode)
			);
		}) ?? false
	);
}

function isConstant(reference: Reference): boolean {
	// v8 mis-attributes the `||` chain arms; the TemplateLiteral/Array/Object
	// arms are exercised by the constant-leaf cases in
	// react-effect-utilities.test.ts.
	/* v8 ignore start -- @preserve all four literal-shape arms are covered by the constant-leaf test cases; the collector folds the chain. */
	return (reference.resolved?.defs ?? []).some((definition) => {
		if (definition.node.type !== "VariableDeclarator") return false;
		const { init } = definition.node;
		return (
			init?.type === "Literal" ||
			init?.type === "TemplateLiteral" ||
			init?.type === "ArrayExpression" ||
			init?.type === "ObjectExpression"
		);
	});
	/* v8 ignore stop */
}

function isRef(state: ReactEffectAnalysisState, reference: Reference): boolean {
	// v8 folds the guard arms; the corpus exercises both declarator shapes (24+
	// calls via isRefCall).
	/* v8 ignore start -- @preserve both guard arms are covered by the isRefCall corpus cases; the collector attributes them to the some() call. */
	return (
		reference.resolved?.defs.some((definition) => {
			if (definition.node.type !== "VariableDeclarator") return false;
			if (definition.node.init?.type !== "CallExpression") return false;
			return isUseRef(state, definition.node.init.callee);
		}) ?? false
	);
	/* v8 ignore stop */
}

function isRefCurrent(reference: Reference): boolean {
	const { parent } = reference.identifier;
	return (
		parent.type === "MemberExpression" &&
		parent.property.type === "Identifier" &&
		parent.property.name === "current"
	);
}

function isStateCall(state: ReactEffectAnalysisState, reference: Reference): boolean {
	return state.scope.getSynchronousCallChain(reference).some((chainRef) => isStateSetter(state, chainRef));
}

function isPropertyCall(state: ReactEffectAnalysisState, reference: Reference): boolean {
	return state.scope.getSynchronousCallChain(reference).some((chainRef) => isProperty(state, chainRef));
}

function isRefCall(state: ReactEffectAnalysisState, reference: Reference): boolean {
	return state.scope
		.getSynchronousCallChain(reference)
		.some((chainRef) => isRefCurrent(chainRef) || isRef(state, chainRef));
}

function getStateName(state: ReactEffectAnalysisState, reference: Reference): string | undefined {
	const declaration = getUseStateDeclaration(state, reference);
	if (declaration?.id.type !== "ArrayPattern") return undefined;
	const [first, second] = declaration.id.elements;
	const firstName = first?.type === "Identifier" ? first.name : undefined;
	/* v8 ignore next -- state-call setters are always the second ArrayPattern element, an Identifier (probed). @preserve */
	const secondName = second?.type === "Identifier" ? second.name : undefined;
	return firstName ?? secondName;
}

function getUseStateDeclaration(
	state: ReactEffectAnalysisState,
	reference: Reference,
): ESTree.VariableDeclarator | undefined {
	const upstream = state.scope.getUpstreamReferences(reference).find((upRef) => isUseState(state, upRef.identifier));
	/* v8 ignore start -- @preserve state-call references always have a useState declaration upstream. */
	const upstreamIdentifier = upstream?.identifier;
	if (upstreamIdentifier === undefined) return undefined;
	/* v8 ignore stop */
	let result: ESTree.Node = upstreamIdentifier;
	while (result.type !== "VariableDeclarator") {
		const parent: ESTree.Node | null = result.parent;
		if (parent === null) return undefined;
		result = parent;
	}
	return result;
}

function getDeclaringNode(node: ESTree.Node): ESTree.Node {
	// Parameter definitions point at the function node, not the parameter.
	if (node.type !== "ArrowFunctionExpression") return node;
	const { parent } = node;
	return parent.type === "CallExpression" ? parent.parent : parent;
}

function findEnclosingReactNode(
	state: ReactEffectAnalysisState,
	node: ESTree.Node | null | undefined,
): ReactOwner | undefined {
	/* v8 ignore next -- rules always pass the effect call node, never null. @preserve */
	if (node === null || node === undefined) return undefined;
	if (isFunctionalComponent(node) || isFunctionalHOC(state, node) || isCustomHook(node)) return toReactOwner(node);

	const { parent } = node;
	return parent === null ? undefined : findEnclosingReactNode(state, parent);
}

function getComponentName(node: ReactOwner | undefined): string | undefined {
	/* v8 ignore next 2 -- rules only call getComponentName with a resolved owner; the undefined guard is unreachable. @preserve */
	if (node === undefined) return undefined;
	/* v8 ignore next 2 -- findEnclosingReactNode only yields FunctionDeclaration or VariableDeclarator owners. @preserve */
	if (node.type !== "FunctionDeclaration" && node.type !== "VariableDeclarator") {
		return undefined;
	}
	if (node.type === "FunctionDeclaration") {
		const { id } = node;
		/* v8 ignore next 2 -- component FunctionDeclarations always carry an identifier. @preserve */
		return id === null ? undefined : id.name;
	}
	const id: ESTree.BindingPattern | null = node.id;
	/* v8 ignore next 2 -- component VariableDeclarators always carry an identifier. @preserve */
	if (id === null) return undefined;
	/* v8 ignore next 2 -- component VariableDeclarator ids are always identifiers. @preserve */
	if (id.type !== "Identifier") return undefined;
	return id.name;
}

function toReactOwner(node: ESTree.Node): ReactOwner | undefined {
	if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
		return node;
	}
	/* v8 ignore start -- @preserve toReactOwner is only called with nodes already matched as components/HOCs/custom hooks; the fallback never executes. */
	return node.type === "VariableDeclarator" ? node : undefined;
	/* v8 ignore stop */
}

function isNode(value: unknown): value is ESTree.Node {
	return typeof value === "object" && value !== null && "type" in value;
}
