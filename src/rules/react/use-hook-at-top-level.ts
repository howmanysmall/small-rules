import { Predicate } from "effect";

import { createRule } from "$oxc-utilities/create-rule";
import {
	isAnyFunction,
	isComponentName,
	isFunctionDeclaration,
	isIdentifierName,
	isImportSpecifier,
	isMemberExpression,
	isMethodDefinition,
	isProperty,
	isTryStatement,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";
import { getHookName } from "$oxc-utilities/react-hook-utilities";

import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";

interface ControlFlowContext {
	readonly afterEarlyReturn: boolean;
	readonly functionDepth: number;
	readonly inConditional: boolean;
	readonly inLoop: boolean;
	readonly inNestedFunction: boolean;
	readonly inTryBlock: boolean;
	readonly isComponentOrHook: boolean;
}

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
	if (isVariableDeclarator(parent) && isIdentifierName(parent.id)) {
		return isComponentName(parent.id.name) || isReactHookName(parent.id.name);
	}

	if (isProperty(parent) && isIdentifierName(parent.key)) {
		return isComponentName(parent.key.name) || isReactHookName(parent.key.name);
	}

	if (isMethodDefinition(parent) && isIdentifierName(parent.key)) {
		return isComponentName(parent.key.name) || isReactHookName(parent.key.name);
	}

	return false;
}

function isHookCall(node: ESTree.CallExpression): boolean {
	const hookName = getHookName(node);
	return hookName !== undefined && isReactHookName(hookName);
}

function isInFinallyBlock(node: ESTree.Node): boolean {
	let current: ESTree.Node | null = node.parent;
	const maxDepth = 20;
	let inFinallyBlock = false;

	// oxlint-disable-next-line unicorn-js/prefer-simple-condition-first -- no?
	for (let depth = 0; depth < maxDepth && current !== null; depth += 1) {
		if (isAnyFunction(current)) break;

		if (isTryStatement(current)) {
			let checkNode: ESTree.Node | null = node;
			while (checkNode !== null && checkNode !== current) {
				if (checkNode === current.finalizer) {
					inFinallyBlock = true;
					break;
				}
				checkNode = checkNode.parent;
			}
			break;
		}

		current = current.parent;
	}

	return inFinallyBlock;
}

function isRecursiveCall(node: ESTree.CallExpression, functionName?: string): boolean {
	if (functionName === undefined) return false;
	return isIdentifierName(node.callee) && node.callee.name === functionName;
}

function makeContext(overrides: Partial<ControlFlowContext>, depth: number): ControlFlowContext {
	return {
		afterEarlyReturn: false,
		functionDepth: depth,
		inConditional: false,
		inLoop: false,
		inNestedFunction: false,
		inTryBlock: false,
		isComponentOrHook: false,
		...overrides,
	};
}

function getFunctionName(node: CallbackFunction): string | undefined {
	return isFunctionDeclaration(node) ? (node.id?.name ?? undefined) : undefined;
}

function getIdentifierNameFromExpression(node: ESTree.Expression): string | undefined {
	return isIdentifierName(node) ? node.name : undefined;
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

	const importSource = isIdentifierName(node.callee) ? importSourceMap.get(hookName) : undefined;
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

const useHookAtTopLevel = createRule("use-hook-at-top-level", "react", {
	create(context): Visitor {
		const config = getOptions(context.options[0]);
		const contextStack = new Array<ControlFlowContext>();
		const functionNameStack = new Array<string | undefined>();
		let currentFunctionName: string | undefined;
		const importSourceMap = new Map<string, string>();

		function getCurrentContext(): ControlFlowContext | undefined {
			return contextStack.length > 0 ? contextStack.at(-1) : undefined;
		}

		function pushContext(newContext: ControlFlowContext): void {
			contextStack.push(newContext);
		}

		function popContext(): void {
			contextStack.pop();
		}

		function updateContext(updates: Partial<ControlFlowContext>): void {
			const current = getCurrentContext();
			if (current === undefined) return;
			contextStack[contextStack.length - 1] = { ...current, ...updates };
		}

		function shouldIgnoreHook(hookName: string, node: ESTree.CallExpression): boolean {
			const { ignoreHooks, importSources, onlyHooks } = config;

			if (onlyHooks !== undefined && onlyHooks.length > 0) return !onlyHooks.includes(hookName);
			if (ignoreHooks?.includes(hookName) === true) return true;

			return shouldIgnoreHookImportSource(hookName, node, importSources, importSourceMap);
		}

		function handleFunctionEnter(node: CallbackFunction): void {
			const current = getCurrentContext();
			const depth = current === undefined ? 0 : current.functionDepth + 1;
			const isComponentOrHookFlag = isComponentOrHook(node);

			functionNameStack.push(currentFunctionName);

			const functionName = getFunctionName(node);
			if (functionName !== undefined) currentFunctionName = functionName;

			if (current?.isComponentOrHook === true) {
				pushContext(makeContext({ functionDepth: depth, inNestedFunction: true }, depth));
			} else if (isComponentOrHookFlag) {
				pushContext(makeContext({ functionDepth: depth, isComponentOrHook: true }, depth));
			}
		}

		function handleFunctionExit(): void {
			if (getCurrentContext() !== undefined) popContext();
			currentFunctionName = functionNameStack.pop();
		}

		function yesConditional(): void {
			updateContext({ inConditional: true });
		}
		function noConditional(): void {
			updateContext({ inConditional: false });
		}

		function noLoop(): void {
			updateContext({ inLoop: false });
		}
		function yesLoop(): void {
			updateContext({ inLoop: true });
		}

		return {
			ArrowFunctionExpression: handleFunctionEnter,
			"ArrowFunctionExpression:exit": handleFunctionExit,
			CallExpression(node): void {
				if (!isHookCall(node)) return;

				const hookName = getHookName(node);
				if (hookName === undefined || shouldIgnoreHook(hookName, node)) return;

				const current = getCurrentContext();
				if (
					current === undefined ||
					(!current.isComponentOrHook && !current.inNestedFunction) ||
					isInFinallyBlock(node)
				) {
					return;
				}

				if (isRecursiveCall(node, currentFunctionName)) {
					context.report({
						messageId: "recursiveHookCall",
						node,
					});
					return;
				}

				if (current.inNestedFunction) {
					context.report({
						messageId: "nestedFunction",
						node,
					});
					return;
				}

				if (current.inConditional) {
					context.report({
						messageId: "conditionalHook",
						node,
					});
					return;
				}

				if (current.inLoop) {
					context.report({
						messageId: "loopHook",
						node,
					});
					return;
				}

				if (current.inTryBlock) {
					context.report({
						messageId: "tryBlockHook",
						node,
					});
					return;
				}

				if (current.afterEarlyReturn) {
					context.report({
						messageId: "afterEarlyReturn",
						node,
					});
				}
			},

			ConditionalExpression: yesConditional,
			"ConditionalExpression:exit": noConditional,

			DoWhileStatement: yesLoop,
			"DoWhileStatement:exit": noLoop,

			ForInStatement: yesLoop,
			"ForInStatement:exit": noLoop,

			ForOfStatement: yesLoop,
			"ForOfStatement:exit": noLoop,

			ForStatement: yesLoop,
			"ForStatement:exit": noLoop,

			FunctionDeclaration: handleFunctionEnter,
			"FunctionDeclaration:exit": handleFunctionExit,

			FunctionExpression: handleFunctionEnter,
			"FunctionExpression:exit": handleFunctionExit,

			IfStatement: yesConditional,
			"IfStatement:exit": noConditional,

			ImportDeclaration(node): void {
				/* v8 ignore start -- @preserve no import-source filtering is a no-op fast path. */
				if (config.importSources === undefined || Object.keys(config.importSources).length === 0) {
					return;
				}
				/* v8 ignore stop -- @preserve */

				const source = node.source.value;
				for (const specifier of node.specifiers) {
					if (!isImportSpecifier(specifier)) continue;
					/* v8 ignore next -- @preserve ImportSpecifier imported names are identifiers for supported parser input. */
					if (!isIdentifierName(specifier.imported)) continue;
					if (isReactHookName(specifier.imported.name)) {
						importSourceMap.set(specifier.local.name, source);
					}
				}
			},

			LogicalExpression: yesConditional,
			"LogicalExpression:exit": noConditional,

			"ReturnStatement:exit"(): void {
				updateContext({ afterEarlyReturn: true });
			},

			SwitchStatement: yesConditional,
			"SwitchStatement:exit": noConditional,

			TryStatement(): void {
				updateContext({ inTryBlock: true });
			},
			"TryStatement:exit"(): void {
				updateContext({ inTryBlock: false });
			},

			WhileStatement: yesLoop,
			"WhileStatement:exit": noLoop,
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
