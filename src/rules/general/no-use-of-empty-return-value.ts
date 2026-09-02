import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isAnyFunction,
	isArrowFunctionExpression,
	isAwaitExpression,
	isBindingIdentifier,
	isCallbackFunction,
	isConditionalExpression,
	isExpressionStatement,
	isLogicalExpression,
	isReturnStatement,
	isSequenceExpression,
	isThrowStatement,
	isUnaryExpression,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Variable, Visitor } from "oxlint-plugin-utilities";

type FunctionLike = ESTree.ArrowFunctionExpression | ESTree.Function;

function parentUsesValue(parent: ESTree.Node, child: ESTree.Node): boolean {
	let currentParent = parent;
	let currentChild = child;

	while (isSequenceExpression(currentParent)) {
		if (currentParent.expressions.at(-1) !== currentChild) return false;
		currentChild = currentParent;
		currentParent = currentParent.parent;
	}

	if (isLogicalExpression(currentParent)) return currentParent.left === currentChild;
	if (isConditionalExpression(currentParent)) return currentParent.test === currentChild;
	return (
		!isExpressionStatement(currentParent) &&
		!isArrowFunctionExpression(currentParent) &&
		!isUnaryExpression(currentParent) &&
		!isAwaitExpression(currentParent) &&
		!isReturnStatement(currentParent) &&
		!isThrowStatement(currentParent)
	);
}

function callReturnValueIsUsed(callExpression: ESTree.CallExpression): boolean {
	return parentUsesValue(callExpression.parent, callExpression);
}

function functionFromVariable(variable: Variable): FunctionLike | undefined {
	if (variable.defs.length !== 1) return undefined;

	const [definition] = variable.defs;
	/* v8 ignore next -- length === 1 guarantees a definition entry. @preserve */
	if (definition === undefined) return undefined;

	if (definition.type === "FunctionName" && isAnyFunction(definition.node)) return definition.node;
	if (
		definition.type === "Variable" &&
		isVariableDeclarator(definition.node) &&
		isCallbackFunction(definition.node.init)
	) {
		return definition.node.init;
	}
	return undefined;
}

const noUseOfEmptyReturnValue = createRule("no-use-of-empty-return-value", "general", {
	create(context): Visitor {
		const callExpressionsToCheck = new Map<ESTree.IdentifierReference, FunctionLike>();
		const functionsWithReturnValue = new Set<FunctionLike>();
		const functionStack = new Array<FunctionLike>();

		function enterFunction(node: FunctionLike): void {
			functionStack.push(node);
			if (node.async || node.generator) {
				functionsWithReturnValue.add(node);
				return;
			}
			if (isArrowFunctionExpression(node) && node.expression) functionsWithReturnValue.add(node);
		}

		function exitFunction(): void {
			functionStack.pop();
		}

		return {
			ArrowFunctionExpression: enterFunction,
			"ArrowFunctionExpression:exit": exitFunction,
			CallExpression(node): void {
				if (!callReturnValueIsUsed(node) || !isBindingIdentifier(node.callee)) return;

				const scope = context.sourceCode.getScope(node);
				const reference = scope.references.find((entry) => entry.identifier === node.callee);
				const resolved = reference?.resolved ?? getVariableByName(scope, node.callee.name);
				if (resolved === undefined) return;

				const functionNode = functionFromVariable(resolved);
				if (functionNode !== undefined) callExpressionsToCheck.set(node.callee, functionNode);
			},
			FunctionDeclaration: enterFunction,
			"FunctionDeclaration:exit": exitFunction,
			FunctionExpression: enterFunction,
			"FunctionExpression:exit": exitFunction,
			"Program:exit"(): void {
				for (const [callee, functionNode] of callExpressionsToCheck) {
					if (functionsWithReturnValue.has(functionNode)) continue;
					context.report({
						data: { name: callee.name },
						messageId: "removeUseOfOutput",
						node: callee,
					});
				}
			},
			ReturnStatement(node): void {
				if (node.argument === null) return;
				const current = functionStack.at(-1);
				/* v8 ignore next -- ReturnStatement only appears inside function scopes. @preserve */
				if (current !== undefined) functionsWithReturnValue.add(current);
			},
		};
	},
	meta: {
		docs: {
			description: "Disallow using the return value of functions that do not return anything.",
			recommended: true,
		},
		messages: {
			removeUseOfOutput: 'Remove this use of the output from "{{name}}"; "{{name}}" doesn\'t return anything.',
		},
		schema: [],
		type: "problem",
	},
});

export default noUseOfEmptyReturnValue;
