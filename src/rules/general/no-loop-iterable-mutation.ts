import { createRule } from "$oxc-utilities/create-rule";
import {
	ARROW_FUNCTION_EXPRESSION,
	CLASS_DECLARATION,
	CLASS_EXPRESSION,
	FUNCTION_DECLARATION,
	FUNCTION_EXPRESSION,
	getMemberPropertyName,
	isArrayPattern,
	isCallExpression,
	isIdentifierName,
	isIdentifierNamed,
	isMemberExpression,
	isNode,
	isSpreadElement,
	isVariableDeclaration,
	PARENTHESIZED_EXPRESSION,
	TS_AS_EXPRESSION,
	TS_NON_NULL_EXPRESSION,
	TS_SATISFIES_EXPRESSION,
	TS_TYPE_ASSERTION,
	unwrapExpression,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

import type { NodeType } from "$oxc-utilities/oxc-utilities";

const ALL_MUTATION_METHODS = new Set([
	"add",
	"clear",
	"copyWithin",
	"delete",
	"fill",
	"pop",
	"push",
	"reverse",
	"set",
	"shift",
	"sort",
	"splice",
	"unshift",
]);
const ITERATOR_METHODS = new Set(["entries", "keys", "values"]);
const SKIPPED_NODE_TYPES = new Set([
	ARROW_FUNCTION_EXPRESSION,
	CLASS_DECLARATION,
	CLASS_EXPRESSION,
	FUNCTION_DECLARATION,
	FUNCTION_EXPRESSION,
]);

interface LoopContext {
	readonly addArgumentName: string | undefined;
	readonly deleteArgumentName: string | undefined;
	readonly iterableName: string;
	readonly setKeyName: string | undefined;
}

interface MutationCall {
	readonly call: ESTree.CallExpression;
	readonly method: string;
	readonly property: ESTree.Node;
}

const NO_NAME = new Set<NodeType>([
	PARENTHESIZED_EXPRESSION,
	TS_AS_EXPRESSION,
	TS_NON_NULL_EXPRESSION,
	TS_SATISFIES_EXPRESSION,
	TS_TYPE_ASSERTION,
]);
type NoName =
	| ESTree.ParenthesizedExpression
	| ESTree.TSAsExpression
	| ESTree.TSNonNullExpression
	| ESTree.TSSatisfiesExpression
	| ESTree.TSTypeAssertion;
function isNoName(node: ESTree.Node): node is NoName {
	return NO_NAME.has(node.type);
}

function getIdentifierName(node?: ESTree.Node | null): string | undefined {
	let current = node;
	while (current !== null && current !== undefined) {
		if (isIdentifierName(current)) return current.name;
		if (!isNoName(current)) return undefined;
		current = current.expression;
	}
	return undefined;
}

function getFirstArrayPatternName(node: ESTree.Node): string | undefined {
	if (!isArrayPattern(node)) return undefined;
	return getIdentifierName(node.elements[0] ?? undefined);
}

function getLoopBinding(loop: ESTree.ForOfStatement): ESTree.Node | undefined {
	/* v8 ignore if -- only called after const VariableDeclaration binding checks. @preserve */
	if (isVariableDeclaration(loop.left)) {
		const [declarator] = loop.left.declarations;
		/* v8 ignore next -- const for-of always has a declarator. @preserve */
		return declarator?.id;
	}
	/* v8 ignore next -- only called after const VariableDeclaration binding checks. @preserve */
	return loop.left;
}

function isConstantLoopBinding(loop: ESTree.ForOfStatement): boolean {
	return isVariableDeclaration(loop.left) && loop.left.kind === "const";
}

function getLiveIterable(right: ESTree.Expression): undefined | { method: string; name: string } {
	const node = unwrapExpression(right);
	if (isIdentifierName(node)) return { name: node.name, method: "direct" };

	if (!isCallExpression(node) || !isMemberExpression(node.callee) || node.arguments.length > 0) return undefined;
	if (node.callee.optional || !isIdentifierName(node.callee.object)) return undefined;

	const method = getMemberPropertyName(node.callee);
	if (method === undefined || !ITERATOR_METHODS.has(method)) return undefined;
	return { name: node.callee.object.name, method };
}

function buildLoopContext(loop: ESTree.ForOfStatement): LoopContext | undefined {
	const iterable = getLiveIterable(loop.right);
	if (iterable === undefined) return undefined;

	if (!isConstantLoopBinding(loop)) {
		return {
			addArgumentName: undefined,
			deleteArgumentName: undefined,
			iterableName: iterable.name,
			setKeyName: undefined,
		};
	}

	const binding = getLoopBinding(loop);
	/* v8 ignore next -- const for-of VariableDeclarations always declare a binding. @preserve */
	if (binding === undefined) return undefined;

	let addArgumentName: string | undefined;
	let setKeyName: string | undefined;
	let deleteArgumentName: string | undefined;

	if (iterable.method === "entries") {
		addArgumentName = getFirstArrayPatternName(binding);
		setKeyName = addArgumentName;
		deleteArgumentName = addArgumentName;
	} else if (iterable.method === "keys") {
		setKeyName = getIdentifierName(binding);
		deleteArgumentName = setKeyName;
	} else {
		addArgumentName = getIdentifierName(binding);
		deleteArgumentName = addArgumentName ?? getFirstArrayPatternName(binding);
		setKeyName = getFirstArrayPatternName(binding);
	}

	return {
		addArgumentName,
		deleteArgumentName,
		iterableName: iterable.name,
		setKeyName,
	};
}

function argumentMatchesName(call: ESTree.CallExpression, name: string | undefined): boolean {
	if (name === undefined) return false;
	const [argument] = call.arguments;
	return argument !== undefined && !isSpreadElement(argument) && getIdentifierName(argument) === name;
}

function pushChildren(node: ESTree.Node, worklist: Array<ESTree.Node>): void {
	for (const [key, value] of Object.entries(node)) {
		if (key === "parent" || key === "range" || key === "loc") continue;
		if (Array.isArray(value)) {
			/* v8 ignore next -- AST child arrays only contain nodes or null pattern holes. @preserve */
			for (const item of value) if (isNode(item)) worklist.push(item);
		} else if (isNode(value)) worklist.push(value);
	}
}

function collectMutationCalls(body: ESTree.Node, iterableName: string): Array<MutationCall> {
	const mutations = new Array<MutationCall>();
	const worklist: Array<ESTree.Node> = [body];
	for (const current of worklist) {
		if (SKIPPED_NODE_TYPES.has(current.type)) continue;
		if (isCallExpression(current) && isMemberExpression(current.callee)) {
			const method = getMemberPropertyName(current.callee);
			const object = unwrapExpression(current.callee.object);
			if (method !== undefined && ALL_MUTATION_METHODS.has(method) && isIdentifierNamed(object, iterableName)) {
				mutations.push({ call: current, method, property: current.callee.property });
			}
		}
		pushChildren(current, worklist);
	}
	return mutations;
}

function isAllowedMutation(
	{ call, method }: MutationCall,
	loopContext: LoopContext,
	mutations: ReadonlyArray<MutationCall>,
): boolean {
	if (method === "delete" && argumentMatchesName(call, loopContext.deleteArgumentName)) return true;

	if (
		(method === "add" && argumentMatchesName(call, loopContext.addArgumentName)) ||
		(method === "set" && argumentMatchesName(call, loopContext.setKeyName))
	) {
		const hasEarlierDelete = mutations.some(
			(other) =>
				other.call.range[0] < call.range[0] &&
				other.method === "delete" &&
				argumentMatchesName(other.call, loopContext.deleteArgumentName),
		);
		return !hasEarlierDelete;
	}

	return false;
}

const noLoopIterableMutation = createRule("no-loop-iterable-mutation", "general", {
	create(context): Visitor {
		return {
			"ForOfStatement:exit"(node): void {
				if (node.await) return;
				const loopContext = buildLoopContext(node);
				if (loopContext === undefined) return;

				const mutations = collectMutationCalls(node.body, loopContext.iterableName);
				for (const mutation of mutations) {
					if (isAllowedMutation(mutation, loopContext, mutations)) continue;
					context.report({
						data: { iterable: loopContext.iterableName },
						messageId: "noLoopIterableMutation",
						node: mutation.property,
					});
				}
			},
		};
	},
	meta: {
		docs: {
			description: "Disallow mutating a loop iterable during iteration.",
			recommended: true,
		},
		messages: {
			noLoopIterableMutation: "Do not mutate `{{iterable}}` while iterating over it.",
		},
		schema: [],
		type: "problem",
	},
});

export default noLoopIterableMutation;
