import {
	getJSXAttributeName,
	hasJSXIdentifierAttribute,
	isReactComponentHigherOrderCall,
} from "$oxc-utilities/component-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { ESTree, Scope, SourceCode, Visitor } from "oxlint-plugin-utilities";

type ScopeVariable = Scope["set"] extends Map<string, infer VariableType> ? VariableType : never;

interface ReactKeysOptions {
	readonly allowRootKeys?: boolean;
	readonly ignoreCallExpressions?: ReadonlyArray<string>;
	readonly iterationMethods?: ReadonlyArray<string>;
	readonly memoizationHooks?: ReadonlyArray<string>;
}

const DEFAULT_OPTIONS: Required<ReactKeysOptions> = {
	allowRootKeys: false,
	ignoreCallExpressions: ["ReactTree.mount", "CreateReactStory", "createReactStory", "createPlatformStory"],
	iterationMethods: [
		"map",
		"filter",
		"forEach",
		"flatMap",
		"reduce",
		"reduceRight",
		"some",
		"every",
		"find",
		"findIndex",
	],
	memoizationHooks: ["useCallback", "useMemo"],
};

const WRAPPER_PARENT_TYPES = new Set([
	"ChainExpression",
	"ParenthesizedExpression",
	"TSAsExpression",
	"TSInstantiationExpression",
	"TSNonNullExpression",
	"TSSatisfiesExpression",
	"TSTypeAssertion",
]);

const ARGUMENT_WRAPPER_TYPES = new Set([
	...WRAPPER_PARENT_TYPES,
	"AwaitExpression",
	"ConditionalExpression",
	"LogicalExpression",
	"SequenceExpression",
	"SpreadElement",
]);

interface CallbackUsage {
	iteration: boolean;
	memoization: boolean;
}

const EMPTY_CALLBACK_USAGE: CallbackUsage = {
	iteration: false,
	memoization: false,
};

const SHOULD_ASCEND_TYPES = new Set(["ConditionalExpression", "LogicalExpression"]);
const IS_FUNCTION_EXPRESSION = new Set(["ArrowFunctionExpression", "FunctionExpression"]);
const CONTROL_FLOW_TYPES = new Set([
	"BlockStatement",
	"CatchClause",
	"DoWhileStatement",
	"ForInStatement",
	"ForOfStatement",
	"ForStatement",
	"IfStatement",
	"LabeledStatement",
	"SwitchCase",
	"SwitchStatement",
	"TryStatement",
	"WhileStatement",
	"WithStatement",
]);

const CHILD_PROP_NAME_SUFFIX = "children";

function getParent(node: ESTree.Node): ESTree.Node | undefined {
	return node.parent ?? undefined;
}

function ascendPastWrappers(node?: ESTree.Node): ESTree.Node | undefined {
	let current = node;
	while (current !== undefined && WRAPPER_PARENT_TYPES.has(current.type)) current = getParent(current);
	return current;
}

function isFunctionLikeNode(node: ESTree.Node): node is CallbackFunction {
	return (
		node.type === "ArrowFunctionExpression" ||
		node.type === "FunctionExpression" ||
		node.type === "FunctionDeclaration"
	);
}

function getEnclosingFunctionLike(node: ESTree.Node): CallbackFunction | undefined {
	let current: ESTree.Node | undefined = getParent(node);

	while (current !== undefined) {
		if (isFunctionLikeNode(current)) return current;
		current = getParent(current);
	}

	return undefined;
}

function getCallbackUsageFromCallExpression(
	callExpression: ESTree.CallExpression,
	iterationMethods: ReadonlySet<string>,
	memoizationHooks: ReadonlySet<string>,
): CallbackUsage {
	const { callee } = callExpression;

	if (callee.type === "Identifier") {
		return {
			iteration: iterationMethods.has(callee.name),
			memoization: memoizationHooks.has(callee.name),
		};
	}

	if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
		const { name } = callee.property;
		const usage: CallbackUsage = {
			iteration: iterationMethods.has(name),
			memoization: memoizationHooks.has(name),
		};

		if (
			name === "from" &&
			callee.object.type === "Identifier" &&
			callee.object.name === "Array" &&
			callExpression.arguments.length >= 2
		) {
			return { ...usage, iteration: true };
		}

		if (
			name === "call" &&
			callee.object.type === "MemberExpression" &&
			callee.object.property.type === "Identifier" &&
			iterationMethods.has(callee.object.property.name)
		) {
			return { ...usage, iteration: true };
		}

		return usage;
	}

	return EMPTY_CALLBACK_USAGE;
}

function findEnclosingCallExpression(node: ESTree.Node): ESTree.CallExpression | undefined {
	let current: ESTree.Node = node;
	let parent: ESTree.Node | undefined = getParent(node);

	while (parent !== undefined) {
		if (parent.type === "CallExpression") {
			for (const argument of parent.arguments) {
				if (argument === current || (argument.type === "SpreadElement" && argument.argument === current)) {
					return parent;
				}
			}
			return undefined;
		}

		if (ARGUMENT_WRAPPER_TYPES.has(parent.type)) {
			current = parent;
			parent = getParent(parent);
			continue;
		}

		break;
	}

	return undefined;
}

function getVariableForFunction(sourceCode: SourceCode, functionLike: CallbackFunction): ScopeVariable | undefined {
	if (functionLike.type === "FunctionDeclaration") {
		const declared = sourceCode.getDeclaredVariables(functionLike);
		/* v8 ignore next -- @preserve parser-backed function declarations always declare their own binding. */
		return declared.length > 0 ? declared[0] : undefined;
	}

	const parent = getParent(functionLike);
	/* v8 ignore next -- @preserve visited function expressions have a parent node in parser-produced ASTs. */
	if (parent === undefined) return undefined;

	if (parent.type === "VariableDeclarator" || parent.type === "AssignmentExpression") {
		const declared = sourceCode.getDeclaredVariables(parent);
		if (declared.length > 0) return declared[0];
	}

	return undefined;
}

function mergeCallbackUsage(target: CallbackUsage, usage: CallbackUsage): void {
	target.iteration ||= usage.iteration;
	target.memoization ||= usage.memoization;
}

function getCallbackUsageFromReference(
	reference: ScopeVariable["references"][number],
	iterationMethods: ReadonlySet<string>,
	memoizationHooks: ReadonlySet<string>,
): CallbackUsage {
	if (reference.isWrite()) return EMPTY_CALLBACK_USAGE;

	const callExpression = findEnclosingCallExpression(reference.identifier);
	if (callExpression === undefined || isReactComponentHigherOrderCall(callExpression)) return EMPTY_CALLBACK_USAGE;

	return getCallbackUsageFromCallExpression(callExpression, iterationMethods, memoizationHooks);
}

function getFunctionCallbackUsage(
	sourceCode: SourceCode,
	functionLike: CallbackFunction,
	iterationMethods: ReadonlySet<string>,
	memoizationHooks: ReadonlySet<string>,
): CallbackUsage {
	const inlineCall = findEnclosingCallExpression(functionLike);
	if (inlineCall !== undefined) {
		if (isReactComponentHigherOrderCall(inlineCall)) return EMPTY_CALLBACK_USAGE;
		return getCallbackUsageFromCallExpression(inlineCall, iterationMethods, memoizationHooks);
	}

	const variable = getVariableForFunction(sourceCode, functionLike);
	if (variable === undefined) return EMPTY_CALLBACK_USAGE;

	const usage: CallbackUsage = {
		iteration: false,
		memoization: false,
	};

	for (const reference of variable.references) {
		mergeCallbackUsage(usage, getCallbackUsageFromReference(reference, iterationMethods, memoizationHooks));
		if (usage.iteration && usage.memoization) return usage;
	}

	return usage;
}

function isTopLevelFunctionReturn(node: ESTree.JSXElement | ESTree.JSXFragment): boolean {
	const parent = getTopLevelReturnParent(node);
	/* v8 ignore next -- @preserve top-level return checks start from parser-attached JSX nodes. */
	if (parent === undefined) return false;

	if (parent.type === "ReturnStatement") {
		return isFunctionReturnStatement(parent);
	}

	return parent.type === "ArrowFunctionExpression";
}

function getTopLevelReturnParent(node: ESTree.JSXElement | ESTree.JSXFragment): ESTree.Node | undefined {
	let parent = ascendPastExpressionContainer(ascendPastWrappers(getParent(node)));

	while (parent !== undefined && SHOULD_ASCEND_TYPES.has(parent.type)) {
		parent = ascendPastWrappers(getParent(parent));
	}

	return ascendPastExpressionContainer(parent);
}

function ascendPastExpressionContainer(parent: ESTree.Node | undefined): ESTree.Node | undefined {
	if (parent?.type !== "JSXExpressionContainer") return parent;
	return ascendPastWrappers(getParent(parent));
}

function isFunctionReturnStatement(parent: ESTree.ReturnStatement): boolean {
	let currentNode: ESTree.Node | undefined = ascendPastWrappers(getParent(parent));

	while (currentNode !== undefined && CONTROL_FLOW_TYPES.has(currentNode.type)) {
		currentNode = ascendPastWrappers(getParent(currentNode));
	}

	/* v8 ignore next -- @preserve return statements that contain JSX are parser-nested inside a function body. */
	if (currentNode === undefined) return false;
	return IS_FUNCTION_EXPRESSION.has(currentNode.type) || currentNode.type === "FunctionDeclaration";
}

function isTopLevelReturn(node: ESTree.JSXElement | ESTree.JSXFragment): boolean {
	if (!isTopLevelFunctionReturn(node)) return false;

	const functionLike = getEnclosingFunctionLike(node);
	/* v8 ignore next -- @preserve a top-level JSX function return implies an enclosing function-like node. */
	if (functionLike === undefined) return false;

	const functionParent = ascendPastWrappers(getParent(functionLike));
	if (functionParent?.type === "CallExpression") {
		return isReactComponentHigherOrderCall(functionParent);
	}

	return true;
}

function isIgnoredCallExpression(
	node: ESTree.JSXElement | ESTree.JSXFragment,
	ignoreList: ReadonlyArray<string>,
): boolean {
	let parent: ESTree.Node | undefined = getParent(node);
	/* v8 ignore next -- @preserve visited JSX nodes have parent links in parser-produced ASTs. */
	if (parent === undefined) return false;

	if (parent.type === "JSXExpressionContainer") {
		parent = getParent(parent);
		/* v8 ignore next -- @preserve parser-produced JSX expression containers are attached to a parent. */
		if (parent === undefined) return false;
	}

	const maxDepth = 20;
	for (let depth = 0; depth < maxDepth && parent !== undefined; depth += 1) {
		if (parent.type === "CallExpression") {
			const { callee } = parent;
			if (callee.type === "Identifier") return ignoreList.includes(callee.name);

			if (
				callee.type === "MemberExpression" &&
				callee.object.type === "Identifier" &&
				callee.property.type === "Identifier"
			) {
				return ignoreList.includes(`${callee.object.name}.${callee.property.name}`);
			}

			return false;
		}

		parent = getParent(parent);
	}

	return false;
}

function isChildrenAttributeName(attributeName: string): boolean {
	return attributeName.toLowerCase().endsWith(CHILD_PROP_NAME_SUFFIX);
}

function isJsxPropertyValue(node: ESTree.JSXElement | ESTree.JSXFragment): boolean {
	let parent: ESTree.Node | undefined = getParent(node);
	/* v8 ignore next -- @preserve visited JSX nodes have parent links in parser-produced ASTs. */
	if (parent === undefined) return false;

	while (parent !== undefined && (parent.type === "ConditionalExpression" || parent.type === "LogicalExpression")) {
		parent = getParent(parent);
	}

	/* v8 ignore next -- @preserve parser-produced conditional/logical JSX ancestors stay attached to a parent. */
	if (parent === undefined) return false;

	if (parent.type === "JSXExpressionContainer") {
		parent = getParent(parent);
		/* v8 ignore next -- @preserve parser-produced JSX expression containers are attached to a parent. */
		if (parent === undefined) return false;
	}

	if (parent.type !== "JSXAttribute") return false;

	const attributeName = getJSXAttributeName(parent);
	/* v8 ignore next -- @preserve supported parser JSX attribute names resolve to a concrete name. */
	if (attributeName === undefined) return true;

	return !isChildrenAttributeName(attributeName);
}

function isAssignedJSXValue(node: ESTree.JSXElement | ESTree.JSXFragment): boolean {
	let current: ESTree.Node = node;
	let parent = getParent(node);

	while (parent !== undefined && WRAPPER_PARENT_TYPES.has(parent.type)) {
		current = parent;
		parent = getParent(parent);
	}

	/* v8 ignore next -- @preserve visited JSX nodes remain attached while unwrapping parser-produced parents. */
	if (parent === undefined) return false;
	if (parent.type === "VariableDeclarator") return parent.init === current;
	if (parent.type === "AssignmentExpression") return parent.right === current;

	return false;
}

function isTernaryJSXChild(node: ESTree.JSXElement | ESTree.JSXFragment): boolean {
	let current: ESTree.Node | undefined = getParent(node);
	/* v8 ignore next -- @preserve visited JSX nodes have parent links in parser-produced ASTs. */
	if (current === undefined) return false;

	let foundTernary = false;
	while (
		current !== undefined &&
		(current.type === "ConditionalExpression" || WRAPPER_PARENT_TYPES.has(current.type))
	) {
		if (current.type === "ConditionalExpression") foundTernary = true;
		current = getParent(current);
	}

	if (!foundTernary || current?.type !== "JSXExpressionContainer") return false;

	const containerParent = getParent(current);
	/* v8 ignore next -- @preserve parser-produced JSX expression containers are attached to a parent. */
	if (containerParent === undefined) return false;

	return containerParent.type === "JSXElement" || containerParent.type === "JSXFragment";
}

function isLogicalJSXChild(node: ESTree.JSXElement | ESTree.JSXFragment): boolean {
	let current: ESTree.Node | undefined = getParent(node);
	/* v8 ignore next -- @preserve visited JSX nodes have parent links in parser-produced ASTs. */
	if (current === undefined) return false;

	let foundLogical = false;
	while (current !== undefined && (current.type === "LogicalExpression" || WRAPPER_PARENT_TYPES.has(current.type))) {
		/* v8 ignore else -- @preserve current parser output keeps logical JSX operands attached directly to LogicalExpression here. */
		if (current.type === "LogicalExpression") foundLogical = true;
		current = getParent(current);
	}

	if (!foundLogical || current?.type !== "JSXExpressionContainer") return false;

	const containerParent = getParent(current);
	/* v8 ignore next -- @preserve parser-produced JSX expression containers are attached to a parent. */
	if (containerParent === undefined) return false;

	return containerParent.type === "JSXElement" || containerParent.type === "JSXFragment";
}

const requireReactComponentKeys = defineRule({
	create(context): Visitor {
		const [configuredOptions] = context.options;
		const options: Required<ReactKeysOptions> = {
			allowRootKeys: DEFAULT_OPTIONS.allowRootKeys,
			ignoreCallExpressions: DEFAULT_OPTIONS.ignoreCallExpressions,
			iterationMethods: DEFAULT_OPTIONS.iterationMethods,
			memoizationHooks: DEFAULT_OPTIONS.memoizationHooks,
			...configuredOptions,
		};

		const iterationMethods = new Set(options.iterationMethods);
		const memoizationHooks = new Set(options.memoizationHooks);

		function checkElement(node: ESTree.JSXElement | ESTree.JSXFragment): void {
			const functionLike = getEnclosingFunctionLike(node);
			const callbackUsage =
				functionLike === undefined
					? EMPTY_CALLBACK_USAGE
					: getFunctionCallbackUsage(context.sourceCode, functionLike, iterationMethods, memoizationHooks);
			const isCallback = callbackUsage.iteration || callbackUsage.memoization;
			const isRoot = isTopLevelReturn(node);

			if (isRoot && !isCallback) {
				if (!options.allowRootKeys && node.type === "JSXElement" && hasJSXIdentifierAttribute(node, "key")) {
					context.report({
						messageId: "rootComponentWithKey",
						node,
					});
				}
				return;
			}

			if (isIgnoredCallExpression(node, options.ignoreCallExpressions)) return;
			if (isAssignedJSXValue(node) || isJsxPropertyValue(node) || isTernaryJSXChild(node)) return;
			if (node.type === "JSXFragment" && isLogicalJSXChild(node)) return;
			if (
				node.type === "JSXFragment" &&
				callbackUsage.memoization &&
				!callbackUsage.iteration &&
				isTopLevelFunctionReturn(node)
			) {
				return;
			}

			if (node.type === "JSXFragment") {
				context.report({
					messageId: "missingKey",
					node,
				});
				return;
			}

			if (!hasJSXIdentifierAttribute(node, "key")) {
				context.report({
					messageId: "missingKey",
					node,
				});
			}
		}

		return {
			JSXElement: checkElement,
			JSXFragment: checkElement,
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Require keys on nested React JSX children, fragments, and configured iteration or memoization contexts.",
		},
		messages: {
			missingKey:
				"JSX element in list/callback lacks key prop. React Luau warns about missing keys in _G.__DEV__ mode. Add a unique `key` prop using a stable identifier (not array index).",
			rootComponentWithKey:
				"Root return has unnecessary key prop. The key gets overwritten by the parent anyway. Remove the `key` prop.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowRootKeys: {
						default: false,
						description: "Allow key props on root component returns",
						type: "boolean",
					},
					ignoreCallExpressions: {
						default: DEFAULT_OPTIONS.ignoreCallExpressions,
						description: "Function calls where JSX arguments don't need keys",
						items: { type: "string" },
						type: "array",
					},
					iterationMethods: {
						default: DEFAULT_OPTIONS.iterationMethods,
						description: "Array method names that indicate iteration contexts where keys are required",
						items: { type: "string" },
						type: "array",
					},
					memoizationHooks: {
						default: ["useCallback", "useMemo"],
						description: "Hook names that indicate memoization contexts where keys are required",
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default requireReactComponentKeys;
