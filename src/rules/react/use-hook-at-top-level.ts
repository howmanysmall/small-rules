import {
	isAnyFunction,
	isCallExpression,
	isComponentName,
	isConditionalExpression,
	isFunctionDeclaration,
	isIdentifier,
	isIdentifierNamed,
	isIfStatement,
	isImportSpecifier,
	isLogicalExpression,
	isLoopNode,
	isMemberExpression,
	isMethodDefinition,
	isProperty,
	isSwitchStatement,
	isTryStatement,
	isVariableDeclarator,
} from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";

import { isReactComponentHigherOrderCall } from "$oxc-utilities/component-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { getHookName } from "$oxc-utilities/react-hook-utilities";

import type { CallbackFunction } from "@small-rules/oxlint-utilities";
import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

/**
 * What a function is to the hooks inside it. `component` covers components
 * and custom hooks, `nested` is any function inside one, and `other` is a
 * function hooks are not checked in.
 */
type FunctionKind = "component" | "nested" | "other";

type ControlFlowMessageId = "conditionalHook" | "loopHook" | "tryBlockHook";

type MessageId = "afterEarlyReturn" | "nestedFunction" | "recursiveHookCall" | ControlFlowMessageId;

const IN_FINALLY_BLOCK = "finally";

// How many ancestors up a `finally` block is still recognized.
const FINALLY_SEARCH_DEPTH = 20;

interface UseHookAtTopLevelOptions {
	readonly ignoreHooks?: ReadonlyArray<string>;
	readonly importSources?: Record<string, boolean>;
	readonly onlyHooks?: ReadonlyArray<string>;
}

const HOOK_NAME_PATTERN = /^use[A-Z]/u;

type RuleOptions = InferContextFromRule<typeof useHookAtTopLevel>["options"][0];

function isReactHookName(name: string): boolean {
	return HOOK_NAME_PATTERN.test(name);
}

function getOptions(value: RuleOptions): UseHookAtTopLevelOptions {
	return Predicate.isObject(value) ? value : {};
}

function isComponentOrHook(node: CallbackFunction): boolean {
	if (isFunctionDeclaration(node) && node.id !== null) {
		return isComponentName(node.id.name) || isReactHookName(node.id.name);
	}

	const { parent } = node;
	if (isVariableDeclarator(parent) && isIdentifier(parent.id)) {
		return isComponentName(parent.id.name) || isReactHookName(parent.id.name);
	}

	if (isProperty(parent) && isIdentifier(parent.key)) {
		return isComponentName(parent.key.name) || isReactHookName(parent.key.name);
	}

	if (isMethodDefinition(parent) && isIdentifier(parent.key)) {
		return isComponentName(parent.key.name) || isReactHookName(parent.key.name);
	}

	return isCallExpression(parent) && isReactComponentHigherOrderCall(parent);
}

function getFunctionKind(node: CallbackFunction, parentKind?: FunctionKind): FunctionKind {
	if (parentKind === "component") return "nested";
	if (isComponentOrHook(node)) return "component";
	return parentKind === "nested" ? "nested" : "other";
}

function isHookCall(node: ESTree.CallExpression): boolean {
	const hookName = getHookName(node);
	return hookName !== undefined && isReactHookName(hookName);
}

/**
 * Whether `child` is a part of `parent` that only runs sometimes. Like React's
 * own rule, the test of an `if` or a ternary, the left side of a logical
 * expression, and the discriminant of a `switch` always run.
 *
 * @param child - The node the hook call is inside.
 * @param parent - The parent of `child`.
 * @returns `true` when `child` is a branch of `parent`.
 */
function isConditionalBranch(child: ESTree.Node, parent: ESTree.Node): boolean {
	if (isLogicalExpression(parent)) return child === parent.right;
	if (isConditionalExpression(parent) || isIfStatement(parent)) return child !== parent.test;
	return isSwitchStatement(parent) && child !== parent.discriminant;
}

function isFinalizerWithinReach(tryStatement: ESTree.TryStatement, child: ESTree.Node, depth: number): boolean {
	return depth < FINALLY_SEARCH_DEPTH && child === tryStatement.finalizer;
}

/**
 * Classifies where a hook call sits inside its own function by climbing to
 * that function once. A conditional outranks a loop, which outranks a `try`.
 *
 * @param node - The hook call.
 * @returns The message for the control flow the call is under,
 *   `IN_FINALLY_BLOCK` when the nearest `try` holds it in its `finally`, or
 *   `undefined` when it runs on every call of the function.
 */
function getControlFlow(node: ESTree.CallExpression): ControlFlowMessageId | typeof IN_FINALLY_BLOCK | undefined {
	let child: ESTree.Node = node;
	let parent: ESTree.Node | null = node.parent;
	let inConditional = false;
	let inLoop = false;
	let inTryStatement = false;

	let depth = 0;

	while (parent !== null && !isAnyFunction(parent)) {
		if (isTryStatement(parent)) {
			// Only the nearest `try` decides whether this is a `finally`.
			if (!inTryStatement && isFinalizerWithinReach(parent, child, depth)) return IN_FINALLY_BLOCK;
			inTryStatement = true;
		}

		inLoop ||= isLoopNode(parent);
		inConditional ||= isConditionalBranch(child, parent);
		child = parent;
		({ parent } = parent);
		depth += 1;
	}

	if (inConditional) return "conditionalHook";
	if (inLoop) return "loopHook";
	return inTryStatement ? "tryBlockHook" : undefined;
}

function isRecursiveCall(node: ESTree.CallExpression, functionName?: string): boolean {
	if (functionName === undefined) return false;
	return isIdentifierNamed(node.callee, functionName);
}

function getFunctionName(node: CallbackFunction): string | undefined {
	return isFunctionDeclaration(node) ? (node.id?.name ?? undefined) : undefined;
}

function getIdentifierNameFromExpression(node: ESTree.Expression): string | undefined {
	return isIdentifier(node) ? node.name : undefined;
}

function shouldIgnoreHookImportSource(
	hookName: string,
	node: ESTree.CallExpression,
	importSources: Record<string, boolean> | undefined,
	importSourceMap: ReadonlyMap<string, string>,
): boolean {
	if (importSources === undefined || Object.keys(importSources).length === 0) return false;

	const memberSourceDecision = getMemberHookSourceDecision(node, importSources);
	if (memberSourceDecision !== undefined) return memberSourceDecision;

	const importSource = isIdentifier(node.callee) ? importSourceMap.get(hookName) : undefined;
	if (importSource !== undefined && importSources[importSource] === false) return true;
	if (importSource !== undefined && importSources[importSource] === true) return false;

	return false;
}

function getMemberHookSourceDecision(
	node: ESTree.CallExpression,
	importSources: Record<string, boolean>,
): boolean | undefined {
	if (!isMemberExpression(node.callee)) return undefined;

	const objectName = getIdentifierNameFromExpression(node.callee.object);
	if (objectName !== undefined && importSources[objectName] === false) return true;
	if (objectName !== undefined && importSources[objectName] === true) return false;
	return undefined;
}

function getActiveHookName(node: ESTree.CallExpression): string | undefined {
	return isHookCall(node) ? getHookName(node) : undefined;
}

const useHookAtTopLevel = createRule("use-hook-at-top-level", "react", {
	create(context): Visitor {
		const config = getOptions(context.options[0]);
		// One entry per enclosing function, innermost last. The two stacks
		// stay the same length: every function pushes and pops both.
		const functionKinds = new Array<FunctionKind>();
		const hasReturned = new Array<boolean>();
		const functionNameStack = new Array<string | undefined>();
		let currentFunctionName: string | undefined;
		const importSourceMap = new Map<string, string>();

		function shouldIgnoreHook(hookName: string, node: ESTree.CallExpression): boolean {
			const { ignoreHooks, importSources, onlyHooks } = config;

			if (onlyHooks !== undefined && onlyHooks.length > 0) return !onlyHooks.includes(hookName);
			if (ignoreHooks?.includes(hookName) === true) return true;

			return shouldIgnoreHookImportSource(hookName, node, importSources, importSourceMap);
		}

		function getHookViolation(
			node: ESTree.CallExpression,
			kind: FunctionKind,
			controlFlow?: ControlFlowMessageId,
		): MessageId | undefined {
			if (isRecursiveCall(node, currentFunctionName)) return "recursiveHookCall";
			if (kind === "nested") return "nestedFunction";
			if (controlFlow !== undefined) return controlFlow;
			return hasReturned.at(-1) === true ? "afterEarlyReturn" : undefined;
		}

		function handleFunctionEnter(node: CallbackFunction): void {
			functionNameStack.push(currentFunctionName);

			const functionName = getFunctionName(node);
			if (functionName !== undefined) {
				currentFunctionName = functionName;
			}

			functionKinds.push(getFunctionKind(node, functionKinds.at(-1)));
			hasReturned.push(false);
		}

		function handleFunctionExit(): void {
			functionKinds.pop();
			hasReturned.pop();
			currentFunctionName = functionNameStack.pop();
		}

		return {
			ArrowFunctionExpression: handleFunctionEnter,
			"ArrowFunctionExpression:exit": handleFunctionExit,
			CallExpression(node): void {
				const hookName = getActiveHookName(node);
				if (hookName === undefined) return;
				if (shouldIgnoreHook(hookName, node)) return;

				const kind = functionKinds.at(-1);
				if (kind === undefined || kind === "other") return;

				const controlFlow = getControlFlow(node);
				if (controlFlow === IN_FINALLY_BLOCK) return;

				const messageId = getHookViolation(node, kind, controlFlow);
				if (messageId !== undefined) {
					context.report({ messageId, node });
				}
			},

			FunctionDeclaration: handleFunctionEnter,
			"FunctionDeclaration:exit": handleFunctionExit,

			FunctionExpression: handleFunctionEnter,
			"FunctionExpression:exit": handleFunctionExit,

			ImportDeclaration(node): void {
				/* v8 ignore start -- @preserve no import-source filtering is a no-op fast path. */
				if (config.importSources === undefined || Object.keys(config.importSources).length === 0) return;
				/* v8 ignore stop -- @preserve */

				const source = node.source.value;
				for (const specifier of node.specifiers) {
					if (!isImportSpecifier(specifier)) continue;
					/* v8 ignore next -- @preserve ImportSpecifier imported names are identifiers for supported parser input. */
					if (!isIdentifier(specifier.imported)) continue;

					if (isReactHookName(specifier.imported.name)) {
						importSourceMap.set(specifier.local.name, source);
					}
				}
			},

			"ReturnStatement:exit"(): void {
				// Marks the innermost function only; `fill` leaves an empty
				// stack alone.
				hasReturned.fill(true, -1);
			},
		};
	},
	meta: {
		docs: {
			description:
				"Enforce that React hooks are only called at the top level of components or custom hooks, never conditionally or in nested functions",
			recommended: true,
		},
		messages: {
			afterEarlyReturn:
				"This hook is being called after an early return. Hooks must be called unconditionally and in the same order every render.",
			conditionalHook:
				"This hook is being called conditionally. All hooks must be called in the exact same order in every component render.",
			loopHook:
				"This hook is being called inside a loop. All hooks must be called in the exact same order in every component render.",
			nestedFunction:
				"This hook is being called from a nested function. All hooks must be called unconditionally from the top-level component.",
			recursiveHookCall:
				"This hook is being called recursively. Recursive calls require a condition to terminate, which violates hook rules.",
			tryBlockHook:
				"This hook is being called inside a try block. Hooks must be called unconditionally at the top level.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					ignoreHooks: {
						description: "Hook names that should be ignored even when they match the hook naming pattern.",
						items: { type: "string" },
						type: "array",
					},
					importSources: {
						additionalProperties: { type: "boolean" },
						description:
							"Import sources or namespace names mapped to whether their hooks should be checked.",
						type: "object",
					},
					onlyHooks: {
						description: "If set, only these hook names are checked.",
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

export default useHookAtTopLevel;
