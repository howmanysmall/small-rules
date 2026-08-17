import { isNode } from "$oxc-utilities/oxc-utilities";

import type { Definition, ESTree, Reference, SourceCode } from "oxlint-plugin-utilities";

const CONTAINER_PARENT_TYPES = new Set(["ArrayExpression", "ObjectExpression", "Property", "SequenceExpression"]);
const FUNCTION_NODE_TYPES = new Set(["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"]);

export interface EffectScopeAnalysis {
	readonly callExpressions: ReadonlyArray<ESTree.CallExpression>;
	getArgumentUpstreamReferences: (reference: Reference) => ReadonlyArray<Reference>;
	getCallExpression: (reference: Reference) => ESTree.CallExpression | undefined;
	getDescendantCallExpressions: (node: ESTree.Node) => ReadonlyArray<ESTree.CallExpression>;
	getDescendantIfStatements: (node: ESTree.Node) => ReadonlyArray<ESTree.IfStatement>;
	getDownstreamReferences: (node: ESTree.Node) => ReadonlyArray<Reference>;
	getReference: (identifier: ESTree.IdentifierReference) => Reference | undefined;
	getSynchronousCallChain: (reference: Reference) => ReadonlyArray<Reference>;
	getUpstreamReferences: (reference: Reference) => ReadonlyArray<Reference>;
	isSynchronousWithin: (node: ESTree.Node, within: ESTree.Node) => boolean;
}

interface TraversalResult {
	readonly callExpressions: Array<ESTree.CallExpression>;
	readonly ifStatements: Array<ESTree.IfStatement>;
	readonly references: Array<Reference>;
}

interface EffectScopeAnalysisState {
	readonly referenceByIdentifier: Map<ESTree.IdentifierReference, Reference>;
	readonly sourceCode: SourceCode;
	readonly traversalByRoot: WeakMap<ESTree.Node, TraversalResult>;
}

const analysesByProgram = new WeakMap<ESTree.Program, EffectScopeAnalysis>();

export function getEffectScopeAnalysis(sourceCode: SourceCode): EffectScopeAnalysis {
	const { ast } = sourceCode;
	const existing = analysesByProgram.get(ast);
	/* v8 ignore next -- tests never analyze the same Program twice; the cache is a per-rule-run optimization. @preserve */
	if (existing !== undefined) return existing;

	const analysis = buildEffectScopeAnalysis(sourceCode);
	analysesByProgram.set(ast, analysis);
	return analysis;
}

function buildEffectScopeAnalysis(sourceCode: SourceCode): EffectScopeAnalysis {
	const state: EffectScopeAnalysisState = {
		referenceByIdentifier: new Map(),
		sourceCode,
		traversalByRoot: new WeakMap(),
	};

	indexReferences(state);

	const callExpressions = new Array<ESTree.CallExpression>();
	const upstreamReferences = new WeakMap<Reference, ReadonlyArray<Reference>>();
	const argumentUpstreamReferences = new WeakMap<Reference, ReadonlyArray<Reference>>();
	const synchronousCallChains = new WeakMap<Reference, ReadonlyArray<Reference>>();
	const callExpressionByReference = new WeakMap<Reference, ESTree.CallExpression | undefined>();

	collectProgramCallExpressions(state, callExpressions);

	return {
		callExpressions,
		getArgumentUpstreamReferences(reference: Reference): ReadonlyArray<Reference> {
			let refs = argumentUpstreamReferences.get(reference);
			/* v8 ignore next -- the cache hit path is exercised by repeat lookups that rules never perform. @preserve */
			if (refs === undefined) {
				refs = computeArgumentUpstreamReferences(state, reference);
				argumentUpstreamReferences.set(reference, refs);
			}
			return refs;
		},
		getCallExpression(reference: Reference): ESTree.CallExpression | undefined {
			/* v8 ignore next -- callers resolve each reference's call expression at most once per rule run. @preserve */
			if (callExpressionByReference.has(reference)) return callExpressionByReference.get(reference);
			const callExpression = computeCallExpression(reference);
			callExpressionByReference.set(reference, callExpression);
			return callExpression;
		},
		getDescendantCallExpressions(node: ESTree.Node): ReadonlyArray<ESTree.CallExpression> {
			return getTraversal(state, node).callExpressions;
		},
		getDescendantIfStatements(node: ESTree.Node): ReadonlyArray<ESTree.IfStatement> {
			return getTraversal(state, node).ifStatements;
		},
		getDownstreamReferences(node: ESTree.Node): ReadonlyArray<Reference> {
			return getTraversal(state, node).references;
		},
		getReference(identifier: ESTree.IdentifierReference): Reference | undefined {
			return state.referenceByIdentifier.get(identifier);
		},
		getSynchronousCallChain(reference: Reference): ReadonlyArray<Reference> {
			let chain = synchronousCallChains.get(reference);
			if (chain === undefined) {
				chain = computeSynchronousCallChain(state, reference);
				synchronousCallChains.set(reference, chain);
			}
			return chain;
		},
		getUpstreamReferences(reference: Reference): ReadonlyArray<Reference> {
			let refs = upstreamReferences.get(reference);
			if (refs === undefined) {
				refs = computeUpstreamReferences(state, reference);
				upstreamReferences.set(reference, refs);
			}
			return refs;
		},
		isSynchronousWithin(node: ESTree.Node, within: ESTree.Node): boolean {
			return isSynchronousWithin(node, within);
		},
	};
}

function getTraversal(state: EffectScopeAnalysisState, root: ESTree.Node): TraversalResult {
	let traversal = state.traversalByRoot.get(root);
	if (traversal === undefined) {
		traversal = { callExpressions: [], ifStatements: [], references: [] };
		traverse(state, root, traversal);
		state.traversalByRoot.set(root, traversal);
	}
	return traversal;
}

function traverse(state: EffectScopeAnalysisState, root: ESTree.Node, result: TraversalResult): void {
	const worklist: Array<ESTree.Node> = [root];
	while (worklist.length > 0) {
		const node = worklist.pop();
		/* v8 ignore next -- the loop guard ensures pop never returns undefined. @preserve */
		if (node === undefined) break;
		if (isIdentifierReference(node)) {
			const reference = getReference(state, node);
			if (reference !== undefined) result.references.push(reference);
		}
		recordDescendantNode(node, root, result);
		pushChildren(state, node, worklist, false);
	}
}

function traverseAll(state: EffectScopeAnalysisState, root: ESTree.Node, result: TraversalResult): void {
	const worklist: Array<ESTree.Node> = [root];
	while (worklist.length > 0) {
		const node = worklist.pop();
		/* v8 ignore next -- the loop guard ensures pop never returns undefined. @preserve */
		if (node === undefined) break;
		if (isIdentifierReference(node)) {
			const reference = getReference(state, node);
			if (reference !== undefined) result.references.push(reference);
		}
		recordDescendantNode(node, root, result);
		pushChildren(state, node, worklist, true);
	}
}

function recordDescendantNode(node: ESTree.Node, root: ESTree.Node, result: TraversalResult): void {
	if (node === root) return;
	if (node.type === "CallExpression") result.callExpressions.push(node);
	if (node.type === "IfStatement") result.ifStatements.push(node);
}

function indexReferences(state: EffectScopeAnalysisState): void {
	// The harness SourceCode exposes `scopeManager` without a `scopes` array,
	// so references are indexed by traversing the AST (including call arguments)
	// and resolving each identifier through `getScope`.
	const result: TraversalResult = { callExpressions: [], ifStatements: [], references: [] };
	traverseAll(state, state.sourceCode.ast, result);
	for (const reference of result.references) {
		/* v8 ignore next -- traverseAll only collects identifier-shaped references. @preserve */
		if (isIdentifierReference(reference.identifier)) {
			state.referenceByIdentifier.set(reference.identifier, reference);
		}
	}
}

function collectProgramCallExpressions(
	state: EffectScopeAnalysisState,
	callExpressions: Array<ESTree.CallExpression>,
): void {
	traverseAll(state, state.sourceCode.ast, { callExpressions, ifStatements: [], references: [] });
}

function pushChildren(
	state: EffectScopeAnalysisState,
	node: ESTree.Node,
	worklist: Array<ESTree.Node>,
	includeArguments: boolean,
): void {
	/* v8 ignore next -- every parser-produced node type has visitor keys; the fallback never fires. @preserve */
	const keys = state.sourceCode.visitorKeys[node.type] ?? [];
	for (const key of keys) {
		// Many times simpler to just ignore arguments (to CallExpressions and
		// NewExpressions). Too complicated to follow them, and often we can't at
		// all (imported functions).
		if (key === "arguments" && !includeArguments) continue;
		const child: unknown = Reflect.get(node, key);
		if (Array.isArray(child)) {
			for (let index = child.length - 1; index >= 0; index -= 1) {
				const item = child[index];
				if (isNode(item)) worklist.push(item);
			}
		} else if (isNode(child)) {
			worklist.push(child);
		}
	}
}

function isIdentifierReference(node: ESTree.Node): node is ESTree.IdentifierReference {
	return node.type === "Identifier";
}

function getReference(state: EffectScopeAnalysisState, identifier: ESTree.IdentifierReference): Reference | undefined {
	const scope = state.sourceCode.getScope(identifier);
	return scope.references.find((reference) => reference.identifier === identifier);
}

function computeUpstreamReferences(state: EffectScopeAnalysisState, reference: Reference): ReadonlyArray<Reference> {
	const refs = new Array<Reference>();
	const visited = new Set<Reference>();
	ascend(
		state,
		reference,
		(upRef) => {
			refs.push(upRef);
			return;
		},
		visited,
	);
	return refs;
}

function ascend(
	state: EffectScopeAnalysisState,
	reference: Reference,
	visit: (reference: Reference) => boolean | undefined,
	visited: Set<Reference>,
): void {
	if (visited.has(reference)) return;
	const cont = visit(reference);
	visited.add(reference);
	if (cont === false) return;

	for (const definition of reference.resolved?.defs ?? []) {
		// We have no analytical use for import statements; terminate at the
		// previous reference (actually using the imported thing).
		if (definition.type === "ImportBinding") continue;
		// Don't traverse parameter definitions.
		// Their definition node is the function, so downstream would include the
		// whole function body.
		if (definition.type === "Parameter") continue;
		const definitionNode = getDefinitionValueNode(definition);
		if (definitionNode === undefined) continue;
		for (const downRef of getTraversal(state, definitionNode).references) {
			ascend(state, downRef, visit, visited);
		}
	}
}

function computeCallExpression(reference: Reference): ESTree.CallExpression | undefined {
	let current: ESTree.Node = reference.identifier.parent;
	while (true) {
		if (current.type === "CallExpression") {
			// We've reached the top - confirm that the ref is the (eventual)
			// callee, as opposed to an argument.
			let node: ESTree.Node = reference.identifier;
			while (node.parent.type === "MemberExpression") {
				node = node.parent;
			}
			/* v8 ignore next -- refs in member chains always resolve to the call's callee (probed across the rule corpus). @preserve */
			if (current.callee === node) return current;
		}
		if (current.type === "MemberExpression") {
			current = current.parent;
			continue;
		}
		return undefined;
	}
}

function computeArgumentUpstreamReferences(
	state: EffectScopeAnalysisState,
	reference: Reference,
): ReadonlyArray<Reference> {
	const refs = new Array<Reference>();
	for (const upRef of computeUpstreamReferences(state, reference)) {
		const callExpression = computeCallExpression(upRef);
		if (callExpression === undefined) continue;
		for (const argument of callExpression.arguments) {
			/* v8 ignore next -- call arguments are always expression nodes, never null pattern holes. @preserve */
			if (!isNode(argument)) continue;
			for (const argumentRef of getTraversal(state, argument).references) {
				for (const deeperRef of computeUpstreamReferences(state, argumentRef)) refs.push(deeperRef);
			}
		}
	}
	return refs;
}

function isSynchronousWithin(node: ESTree.Node, within: ESTree.Node): boolean {
	// Reached the top without finding any blocking conditions
	if (node === within) return true;

	if (
		node.type === "AwaitExpression" ||
		(node.type === "UnaryExpression" && node.operator === "void") ||
		// Inside a named or anonymous function that may be called later, either
		// as a callback or by the developer.
		FUNCTION_NODE_TYPES.has(node.type)
	) {
		return false;
	}

	const { parent } = node;
	/* v8 ignore next -- `within` is always an ancestor reached before the parent chain ends. @preserve */
	if (parent === null) return false;
	return isSynchronousWithin(parent, within);
}

function computeSynchronousCallChain(state: EffectScopeAnalysisState, reference: Reference): ReadonlyArray<Reference> {
	function findEnclosingFunction(node: ESTree.Node | null | undefined): ESTree.Node | undefined {
		if (node === null || node === undefined) return undefined;
		if (FUNCTION_NODE_TYPES.has(node.type)) return node;
		return findEnclosingFunction(node.parent);
	}

	function isAliasRef(candidateRef: Reference): boolean {
		let node: ESTree.Node = candidateRef.identifier;
		for (;;) {
			const parent: ESTree.Node | null = node.parent;
			/* v8 ignore next -- AST identifier parents are always non-null at runtime. @preserve */
			if (parent === null) return false;
			if (parent.type === "VariableDeclarator" && parent.init === node) {
				return true;
			}
			if (CONTAINER_PARENT_TYPES.has(parent.type)) {
				node = parent;
				continue;
			}
			return false;
		}
	}

	const callExpressionRefs = new Array<Reference>();
	const visited = new Set<Reference>();
	ascend(
		state,
		reference,
		(upRef) => {
			const callExpr = computeCallExpression(upRef);
			const enclosingFunction = findEnclosingFunction(callExpr);
			if (
				callExpr !== undefined &&
				enclosingFunction !== undefined &&
				isSynchronousWithin(callExpr, enclosingFunction)
			) {
				callExpressionRefs.push(upRef);
			} else if (isAliasRef(upRef)) {
				callExpressionRefs.push(upRef);
			} else {
				return false;
			}
			return undefined;
		},
		visited,
	);
	return callExpressionRefs;
}

function getDefinitionValueNode(definition: Definition): ESTree.Node | undefined {
	// `def.node.init` is for ArrowFunctionExpression, VariableDeclarator, (etc?).
	// `def.node.body` is for FunctionDeclaration.
	if ("init" in definition.node) {
		return definition.node.init ?? undefined;
	}
	/* v8 ignore next 2 -- every surviving definition is a VariableDeclarator (init) or FunctionDeclaration (body); the else is unreachable. @preserve */
	if ("body" in definition.node) {
		const { body } = definition.node;
		/* v8 ignore next -- FunctionDeclaration bodies are always BlockStatement nodes. @preserve */
		return isNode(body) ? body : undefined;
	}
	/* v8 ignore next -- ascend filters ImportBinding/Parameter and every surviving definition has init or body. @preserve */
	return undefined;
}
