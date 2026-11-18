import {
	CONDITIONAL_EXPRESSION,
	DO_WHILE_STATEMENT,
	FOR_STATEMENT,
	IF_STATEMENT,
	isAnyFunction,
	isCallExpression,
	isIdentifier,
	isLogicalExpression,
	isMemberExpression,
	isNode,
	isSpreadElement,
	isStringLiteral,
	LOGICAL_EXPRESSION,
	WHILE_STATEMENT,
} from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";

import { forEachNode, getVariableByName, STOP_NODE_TRAVERSAL } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { NodeType } from "@small-rules/oxlint-utilities";
import type { ESTree, InferContextFromRule, Reference, SourceCode, Visitor } from "oxlint-plugin-utilities";
import type { UnknownRecord } from "type-fest";

type QueryType = "get" | "has";

type Context = InferContextFromRule<typeof preferSingleWorldQueryInJecs>;

interface WorldQueryCall {
	readonly componentNode: ESTree.Expression;
	readonly entityNode: ESTree.Expression;
	readonly node: ESTree.CallExpression;
	readonly queryType: QueryType;
	readonly variableDeclaration: ESTree.VariableDeclaration;
	readonly variableDeclarator: ESTree.VariableDeclarator;
	readonly variableName: string;
	readonly worldNode: ESTree.Expression;
}

type InspectableNode = ESTree.Node | null | UnknownRecord;

function isLengthOfTwo<TValue>(array: ReadonlyArray<TValue>): array is readonly [TValue, TValue] {
	return array.length === 2;
}

function isStaticMemberExpression(node: ESTree.Expression): node is ESTree.StaticMemberExpression {
	return isMemberExpression(node) && !node.computed;
}

function isWorldQueryCall(node: ESTree.Node, queryType: QueryType): node is ESTree.CallExpression {
	if (!isCallExpression(node)) return false;

	const { callee } = node;
	if (!isStaticMemberExpression(callee) || callee.property.name !== queryType || !isLengthOfTwo(node.arguments)) {
		return false;
	}

	const [entity, component] = node.arguments;
	return !isSpreadElement(entity) && !isSpreadElement(component);
}

function extractWorldQueryCall(node: ESTree.VariableDeclaration, queryType: QueryType): undefined | WorldQueryCall {
	if (node.declarations.length !== 1) return undefined;

	const [declarator] = node.declarations;
	/* v8 ignore next -- @preserve non-empty VariableDeclaration.declarations always yields a first declarator. */
	if (declarator === undefined) return undefined;

	const { id, init } = declarator;
	if (init === null || !isIdentifier(id) || !isWorldQueryCall(init, queryType)) return undefined;

	const { callee } = init;
	/* v8 ignore next 3 -- @preserve isWorldQueryCall already narrows the callee to a static member expression. */
	if (!isStaticMemberExpression(callee)) return undefined;

	const [entityNode, componentNode] = init.arguments;
	/* v8 ignore next 8 -- @preserve isWorldQueryCall already requires exactly two non-spread arguments. */
	if (
		entityNode === undefined ||
		componentNode === undefined ||
		isSpreadElement(entityNode) ||
		isSpreadElement(componentNode)
	) {
		return undefined;
	}

	return {
		componentNode,
		entityNode,
		node: init,
		queryType,
		variableDeclaration: node,
		variableDeclarator: declarator,
		variableName: id.name,
		worldNode: callee.object,
	};
}

const VALID_PARENT_TYPES = new Set<NodeType>([
	CONDITIONAL_EXPRESSION,
	DO_WHILE_STATEMENT,
	FOR_STATEMENT,
	IF_STATEMENT,
	WHILE_STATEMENT,
]);

type NodeWithParent = InspectableNode & {
	readonly parent: InspectableNode;
};

function isNodeWithParent(value: InspectableNode): value is NodeWithParent {
	return Predicate.isObject(value) && "parent" in value;
}

function getNodeType(value: InspectableNode): string | undefined {
	/* v8 ignore next -- @preserve scope reference parents are parser nodes with string type tags. */
	return isNode(value) ? value.type : undefined;
}

function getOperator(value: InspectableNode): string | undefined {
	/* v8 ignore next -- @preserve logical-expression parents expose parser-provided string operators. */
	return Predicate.isObject(value) && Predicate.isString(value.operator) ? value.operator : undefined;
}

function isLogicalAndExpression(value: InspectableNode): boolean {
	return getNodeType(value) === LOGICAL_EXPRESSION && getOperator(value) === "&&";
}

function isIdentifierReference(value: InspectableNode): value is ESTree.IdentifierReference {
	return isNode(value) && isIdentifier(value) && Predicate.isString(value.name);
}

function isIdentifierDirectlyInAndExpression(identifier: ESTree.IdentifierReference): boolean {
	const { parent } = identifier;
	if (isLogicalAndExpression(parent)) return true;

	const parentType = getNodeType(parent);
	if (parentType === undefined || !VALID_PARENT_TYPES.has(parentType)) return false;

	let current: InspectableNode = identifier;
	while (current !== parent) {
		/* v8 ignore next -- @preserve parser-provided reference ancestor chains expose parent links up to the checked parent. */
		if (!isNodeWithParent(current)) break;

		const currentParent: InspectableNode = current.parent;
		/* v8 ignore next -- @preserve direct logical-and parents are handled before walking ancestors. */
		if (isLogicalAndExpression(currentParent)) return true;
		current = currentParent;
	}

	return false;
}

function isReadReferenceInAndExpression(reference: Reference): boolean {
	if (reference.isWrite()) return false;
	const { identifier } = reference;
	/* v8 ignore next -- @preserve ESLint scope references for reads expose identifier reference nodes. */
	if (!isIdentifierReference(identifier)) return false;
	return isIdentifierDirectlyInAndExpression(identifier);
}

function checkVariableUsedInAndExpression(
	variableName: string,
	variableDeclaration: ESTree.VariableDeclaration,
	sourceCode: SourceCode,
): boolean {
	const scope = sourceCode.getScope(variableDeclaration);
	const variable = getVariableByName(scope, variableName);
	/* v8 ignore next -- @preserve extracted query declarators always define the queried variable in their declaration scope. */
	return variable?.references.some(isReadReferenceInAndExpression) ?? false;
}

function areAllVariablesUsedInAndExpressions(calls: ReadonlyArray<WorldQueryCall>, sourceCode: SourceCode): boolean {
	return calls.every((call) =>
		checkVariableUsedInAndExpression(call.variableName, call.variableDeclaration, sourceCode),
	);
}

// Jecs `world.get` accepts at most four components.
const MAXIMUM_GET_COMPONENTS = 4;

const MERGED_HAS_NAME = "hasAll";

const ONLY_WHITESPACE_SEMICOLON = /^[\s;]*$/u;

function areCallsConsecutive(
	previousCall: undefined | WorldQueryCall,
	currentCall: WorldQueryCall,
	sourceCode: SourceCode,
): boolean {
	/* v8 ignore next -- @preserve callers only compare a current query with an existing buffered previous query. */
	if (previousCall === undefined) return true;

	const previousWorld = sourceCode.getText(previousCall.worldNode);
	const currentWorld = sourceCode.getText(currentCall.worldNode);
	if (previousWorld !== currentWorld) return false;

	const previousEntity = sourceCode.getText(previousCall.entityNode);
	const currentEntity = sourceCode.getText(currentCall.entityNode);
	if (previousEntity !== currentEntity || previousCall.queryType !== currentCall.queryType) return false;

	const [, previousEnd] = previousCall.variableDeclaration.range;
	const [currentStart] = currentCall.variableDeclaration.range;
	const textBetween = sourceCode.text.slice(previousEnd, currentStart);
	return ONLY_WHITESPACE_SEMICOLON.test(textBetween);
}

function hasBufferedVariable(buffer: ReadonlyArray<WorldQueryCall>, name: string): boolean {
	for (const { variableName } of buffer) {
		if (variableName === name) return true;
	}

	return false;
}

/**
 * A merged call runs before any of the group's variables exist, so a component
 * that reads one of them cannot be merged.
 *
 * @param call - The query to inspect.
 * @param buffer - The queries in the group.
 * @returns Whether the component reads a variable declared by the group.
 */
function readsBufferedVariable(call: WorldQueryCall, buffer: ReadonlyArray<WorldQueryCall>): boolean {
	let readsVariable = false;

	forEachNode(call.componentNode, (current) => {
		// A nested function only reads the variable later, after it exists.
		if (isAnyFunction(current)) return false;

		if (isIdentifier(current) && hasBufferedVariable(buffer, current.name)) {
			readsVariable = true;
			return STOP_NODE_TRAVERSAL;
		}

		return true;
	});

	return readsVariable;
}

function readsGroupVariable(calls: ReadonlyArray<WorldQueryCall>): boolean {
	for (const call of calls) {
		if (readsBufferedVariable(call, calls)) return true;
	}

	return false;
}

/**
 * Whether a merged call would be wrong to write. It runs before the group's
 * variables exist, and a string key marks a receiver that is not a Jecs
 * world, where the extra arguments mean something else.
 *
 * @param calls - The group of calls the report covers.
 * @returns `true` when the report must carry no fix.
 */
function isMergeUnsafe(calls: ReadonlyArray<WorldQueryCall>): boolean {
	if (readsGroupVariable(calls)) return true;
	return calls.some(({ componentNode, entityNode }) => isStringLiteral(componentNode) || isStringLiteral(entityNode));
}

function processGetCalls(calls: ReadonlyArray<WorldQueryCall>, context: Context): void {
	/* v8 ignore next -- @preserve callers only flush get groups with at least two calls. */
	if (calls.length < 2) return;

	const [firstCall] = calls;
	/* v8 ignore next 3 -- @preserve length guard above guarantees a first call. */
	if (firstCall === undefined) return;

	const { sourceCode } = context;
	const worldText = sourceCode.getText(firstCall.worldNode);
	const entityText = sourceCode.getText(firstCall.entityNode);

	const variableNames = new Array<string>();
	const componentTexts = new Array<string>();

	for (const { componentNode, variableName } of calls) {
		variableNames.push(variableName);
		componentTexts.push(sourceCode.getText(componentNode));
	}

	/* v8 ignore next -- @preserve processGetCalls only receives groups with at least two query variables. */
	const destructuring = variableNames.length === 1 ? variableNames[0] : `[${variableNames.join(", ")}]`;
	const componentArguments = componentTexts.join(", ");
	const fixedCode = `const ${destructuring} = ${worldText}.get(${entityText}, ${componentArguments});`;

	// The merged call runs before any of the group's variables exist.
	if (isMergeUnsafe(calls)) {
		context.report({ data: { fixedCode }, messageId: "preferSingleGet", node: firstCall.node });
		return;
	}

	context.report({
		data: { fixedCode },
		fix(fixer) {
			return fixer.replaceTextRange(getDeclarationsRange(calls), fixedCode);
		},
		messageId: "preferSingleGet",
		node: firstCall.node,
	});
}

function getDeclarationsRange(calls: ReadonlyArray<WorldQueryCall>): ESTree.Node["range"] {
	let start = Number.POSITIVE_INFINITY;
	let end = Number.NEGATIVE_INFINITY;

	for (const { variableDeclaration } of calls) {
		const [declarationStart, declarationEnd] = variableDeclaration.range;
		start = Math.min(start, declarationStart);
		end = Math.max(end, declarationEnd);
	}

	return [start, end];
}

function isAndExpression(node?: ESTree.Node | null): node is ESTree.LogicalExpression {
	return isLogicalExpression(node) && node.operator === "&&";
}

function getAndChainRoot(node: ESTree.Node): ESTree.Node {
	let current = node;
	while (isAndExpression(current.parent)) {
		current = current.parent;
	}

	return current;
}

function hasExactLeaves(root: ESTree.LogicalExpression, leaves: ReadonlySet<ESTree.Node>): boolean {
	let leafCount = 0;
	let matchedCount = 0;

	forEachNode(root, (current) => {
		if (isAndExpression(current)) return true;

		leafCount += 1;

		if (leaves.has(current)) {
			matchedCount += 1;
		}

		return false;
	});

	return leafCount === leaves.size && matchedCount === leaves.size;
}

function collectReads(
	variableDeclarator: ESTree.VariableDeclarator,
	sourceCode: SourceCode,
	reads: Set<ESTree.Node>,
): boolean {
	for (const variable of sourceCode.getDeclaredVariables(variableDeclarator)) {
		for (const reference of variable.references) {
			if (reference.identifier === variableDeclarator.id) continue;
			if (reference.isWrite()) return false;

			reads.add(reference.identifier);
		}
	}

	return true;
}

/**
 * Finds the `&&` chain that reads every merged variable and nothing else, so
 * the whole chain can be replaced by the merged variable.
 *
 * @param calls - The `has` queries being merged.
 * @param declarationsEnd - Where the merged declaration ends.
 * @param sourceCode - The source code that owns the scope analysis.
 * @returns The chain, or undefined when a variable is written, read anywhere
 *   else, read next to an unrelated operand, or the merged name is unusable.
 */
function findReplaceableChain(
	calls: ReadonlyArray<WorldQueryCall>,
	declarationsEnd: number,
	sourceCode: SourceCode,
): ESTree.LogicalExpression | undefined {
	const reads = new Set<ESTree.Node>();
	for (const { variableDeclarator } of calls) {
		if (!collectReads(variableDeclarator, sourceCode, reads)) return undefined;
	}

	let root: ESTree.Node | undefined;
	for (const read of reads) {
		root = getAndChainRoot(read);
	}

	if (!isAndExpression(root) || root.range[0] < declarationsEnd || !hasExactLeaves(root, reads)) return undefined;
	return getVariableByName(sourceCode.getScope(root), MERGED_HAS_NAME) === undefined ? root : undefined;
}

function processHasCalls(calls: ReadonlyArray<WorldQueryCall>, context: Context): void {
	/* v8 ignore next -- @preserve callers only flush has groups with at least two calls. */
	if (calls.length < 2) return;

	const { sourceCode } = context;
	if (!areAllVariablesUsedInAndExpressions(calls, sourceCode)) return;

	const [firstCall] = calls;
	/* v8 ignore next 3 -- @preserve length guard above guarantees a first call. */
	if (firstCall === undefined) return;

	const worldText = sourceCode.getText(firstCall.worldNode);
	const entityText = sourceCode.getText(firstCall.entityNode);
	const componentArguments = calls.map((call) => sourceCode.getText(call.componentNode)).join(", ");
	const fixedCode = `const ${MERGED_HAS_NAME} = ${worldText}.has(${entityText}, ${componentArguments});`;

	const declarationsRange = getDeclarationsRange(calls);
	const chain = isMergeUnsafe(calls) ? undefined : findReplaceableChain(calls, declarationsRange[1], sourceCode);

	if (chain === undefined) {
		context.report({ data: { fixedCode }, messageId: "preferSingleHas", node: firstCall.node });
		return;
	}

	context.report({
		data: { fixedCode },
		fix(fixer) {
			return [fixer.replaceTextRange(declarationsRange, fixedCode), fixer.replaceText(chain, MERGED_HAS_NAME)];
		},
		messageId: "preferSingleHas",
		node: firstCall.node,
	});
}

const preferSingleWorldQueryInJecs = createRule("prefer-single-world-query-in-jecs", "roblox/jecs", {
	create(context): Visitor {
		const { sourceCode } = context;
		let currentGetBuffer = new Array<WorldQueryCall>();
		let currentHasBuffer = new Array<WorldQueryCall>();

		function flushGetBuffer(): void {
			if (currentGetBuffer.length >= 2) {
				processGetCalls(currentGetBuffer, context);
			}

			currentGetBuffer = [];
		}

		function flushHasBuffer(): void {
			if (currentHasBuffer.length >= 2) {
				processHasCalls(currentHasBuffer, context);
			}

			currentHasBuffer = [];
		}

		function flushAllBuffers(): void {
			flushGetBuffer();
			flushHasBuffer();
		}

		return {
			":statement:not(VariableDeclaration[kind='const'])": flushAllBuffers,
			"Program:exit": flushAllBuffers,
			"VariableDeclaration[kind='const']"(node: ESTree.VariableDeclaration): void {
				const getCall = extractWorldQueryCall(node, "get");
				if (getCall !== undefined) {
					const lastCall = currentGetBuffer.at(-1);
					if (
						currentGetBuffer.length === MAXIMUM_GET_COMPONENTS ||
						(lastCall !== undefined && !areCallsConsecutive(lastCall, getCall, sourceCode))
					) {
						flushGetBuffer();
					}

					currentGetBuffer.push(getCall);

					flushHasBuffer();
					return;
				}

				const hasCall = extractWorldQueryCall(node, "has");
				if (hasCall !== undefined) {
					const lastCall = currentHasBuffer.at(-1);
					if (lastCall !== undefined && !areCallsConsecutive(lastCall, hasCall, sourceCode)) {
						flushHasBuffer();
					}

					currentHasBuffer.push(hasCall);

					flushGetBuffer();
					return;
				}

				flushAllBuffers();
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Enforce combining multiple world.get() or world.has() calls into a single call for better Jecs performance.",
		},
		fixable: "code",
		messages: {
			preferSingleGet:
				"Multiple world.get() calls on the same entity should be combined into a single call for better performance. Suggested fix: {{fixedCode}}",
			preferSingleHas:
				"Multiple world.has() calls on the same entity should be combined into a single call for better performance. Suggested fix: {{fixedCode}}",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default preferSingleWorldQueryInJecs;
