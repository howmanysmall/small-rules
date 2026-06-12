import { isComponentName } from "$oxc-utilities/oxc-utilities";
import { getHookName } from "$oxc-utilities/react-hook-utilities";
import { isRecord } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { ESTree, Visitor } from "oxlint-plugin-utilities";

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

function isReactHookName(name: string): boolean {
	return HOOK_NAME_PATTERN.test(name);
}

function getOptions(value: unknown): UseHookAtTopLevelOptions {
	return isRecord(value) ? value : {};
}

function isIdentifierName(node: ESTree.Node): node is ESTree.IdentifierName {
	return node.type === "Identifier";
}

function isComponentOrHook(node: CallbackFunction): boolean {
	if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression") && node.id !== null) {
		return isComponentName(node.id.name) || isReactHookName(node.id.name);
	}

	const { parent } = node;

	if (parent.type === "VariableDeclarator" && isIdentifierName(parent.id)) {
		return isComponentName(parent.id.name) || isReactHookName(parent.id.name);
	}

	if (parent.type === "Property" && isIdentifierName(parent.key)) {
		return isComponentName(parent.key.name) || isReactHookName(parent.key.name);
	}

	if (parent.type === "MethodDefinition" && isIdentifierName(parent.key)) {
		return isComponentName(parent.key.name) || isReactHookName(parent.key.name);
	}

	return false;
}

function isHookCall(node: ESTree.CallExpression): boolean {
	const hookName = getHookName(node);
	return hookName !== undefined && isReactHookName(hookName);
}

const FUNCTION_BOUNDARIES = new Set<string>(["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"]);

function isInFinallyBlock(node: ESTree.Node): boolean {
	let current: ESTree.Node | null = node.parent;
	const maxDepth = 20;
	let inFinallyBlock = false;

	for (let depth = 0; depth < maxDepth && current !== null; depth += 1) {
		if (FUNCTION_BOUNDARIES.has(current.type)) break;

		if (current.type === "TryStatement") {
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

function isRecursiveCall(node: ESTree.CallExpression, functionName: string | undefined): boolean {
	if (functionName === undefined) return false;
	return node.callee.type === "Identifier" && "name" in node.callee && node.callee.name === functionName;
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
	if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") return node.id?.name ?? undefined;
	return undefined;
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

	const importSource = node.callee.type === "Identifier" ? importSourceMap.get(hookName) : undefined;
	if (importSource !== undefined && importSources[importSource] === false) return true;
	if (importSource !== undefined && importSources[importSource] === true) return false;

	return false;
}

function getMemberHookSourceDecision(
	node: ESTree.CallExpression,
	importSources: Record<string, boolean>,
): boolean | undefined {
	if (node.callee.type !== "MemberExpression") return undefined;

	const objectName = getIdentifierNameFromExpression(node.callee.object);
	if (objectName !== undefined && importSources[objectName] === false) return true;
	if (objectName !== undefined && importSources[objectName] === true) return false;
	return undefined;
}

const useHookAtTopLevel = defineRule({
	create(context): Visitor {
		const configuration = getOptions(context.options[0]);
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
			const { ignoreHooks, importSources, onlyHooks } = configuration;

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
			if (functionName !== undefined) {
				currentFunctionName = functionName;
			}

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
					!(current.isComponentOrHook || current.inNestedFunction) ||
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

			ConditionalExpression(): void {
				updateContext({ inConditional: true });
			},
			"ConditionalExpression:exit"(): void {
				updateContext({ inConditional: false });
			},

			DoWhileStatement(): void {
				updateContext({ inLoop: true });
			},
			"DoWhileStatement:exit"(): void {
				updateContext({ inLoop: false });
			},

			ForInStatement(): void {
				updateContext({ inLoop: true });
			},
			"ForInStatement:exit"(): void {
				updateContext({ inLoop: false });
			},

			ForOfStatement(): void {
				updateContext({ inLoop: true });
			},
			"ForOfStatement:exit"(): void {
				updateContext({ inLoop: false });
			},

			ForStatement(): void {
				updateContext({ inLoop: true });
			},
			"ForStatement:exit"(): void {
				updateContext({ inLoop: false });
			},

			FunctionDeclaration: handleFunctionEnter,
			"FunctionDeclaration:exit": handleFunctionExit,
			FunctionExpression: handleFunctionEnter,
			"FunctionExpression:exit": handleFunctionExit,
			IfStatement(): void {
				updateContext({ inConditional: true });
			},
			"IfStatement:exit"(): void {
				updateContext({ inConditional: false });
			},

			ImportDeclaration(node): void {
				const source = node.source.value;

				if (
					configuration.importSources === undefined ||
					Object.keys(configuration.importSources).length === 0
				) {
					return;
				}

				for (const specifier of node.specifiers) {
					if (specifier.type !== "ImportSpecifier") continue;
					if (!isIdentifierName(specifier.imported)) continue;
					if (isReactHookName(specifier.imported.name)) {
						importSourceMap.set(specifier.local.name, source);
					}
				}
			},

			LogicalExpression(): void {
				updateContext({ inConditional: true });
			},
			"LogicalExpression:exit"(): void {
				updateContext({ inConditional: false });
			},

			"ReturnStatement:exit"(): void {
				updateContext({ afterEarlyReturn: true });
			},

			SwitchStatement(): void {
				updateContext({ inConditional: true });
			},
			"SwitchStatement:exit"(): void {
				updateContext({ inConditional: false });
			},

			TryStatement(): void {
				updateContext({ inTryBlock: true });
			},
			"TryStatement:exit"(): void {
				updateContext({ inTryBlock: false });
			},

			WhileStatement(): void {
				updateContext({ inLoop: true });
			},
			"WhileStatement:exit"(): void {
				updateContext({ inLoop: false });
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
						items: { type: "string" },
						type: "array",
					},
					importSources: {
						additionalProperties: { type: "boolean" },
						type: "object",
					},
					onlyHooks: {
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
