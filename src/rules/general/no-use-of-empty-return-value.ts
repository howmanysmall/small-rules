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
} from "@small-rules/oxlint-utilities";

import { pushChildScopes } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { createFunctionStackVisitor } from "$oxc-utilities/function-stack-visitor";
import { getSingleDefinition } from "$oxc-utilities/single-variable-definition";

import type { ESTree, Scope, Variable, Visitor } from "oxlint-plugin-utilities";

type FunctionLike = ESTree.ArrowFunctionExpression | ESTree.Function;

function isValueUsedByParent(parent: ESTree.Node, child: ESTree.Node): boolean {
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
	return isValueUsedByParent(callExpression.parent, callExpression);
}

function getFunctionFromVariable(variable: Variable): FunctionLike | undefined {
	const definition = getSingleDefinition(variable);
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

/**
 * Maps every reference identifier in the file to the variable it resolves to,
 * in one pass over the scope tree. Reading the identifier's own reference keeps
 * a type-only binding of the same name from hiding the value it calls.
 *
 * @param programScope - The scope of the `Program` node.
 * @returns The resolved variable (or `null`) for each reference identifier.
 */
function collectResolvedReferences(programScope: Scope): Map<ESTree.Node, null | Variable> {
	const resolvedByIdentifier = new Map<ESTree.Node, null | Variable>();
	const scopes = [programScope];
	for (const scope of scopes) {
		for (const reference of scope.references) {
			resolvedByIdentifier.set(reference.identifier, reference.resolved);
		}

		pushChildScopes(scopes, scope);
	}

	return resolvedByIdentifier;
}

const noUseOfEmptyReturnValue = createRule("no-use-of-empty-return-value", "general", {
	create(context): Visitor {
		const usedCallees = new Array<ESTree.IdentifierReference>();
		const functionsWithReturnValue = new Set<FunctionLike>();
		const functionStack = new Array<FunctionLike>();

		function enterFunction(node: FunctionLike): FunctionLike {
			if (node.async || node.generator || (isArrowFunctionExpression(node) && node.expression)) {
				functionsWithReturnValue.add(node);
			}

			return node;
		}

		return {
			...createFunctionStackVisitor(functionStack, enterFunction),
			CallExpression(node): void {
				if (callReturnValueIsUsed(node) && isBindingIdentifier(node.callee)) {
					usedCallees.push(node.callee);
				}
			},
			"Program:exit"(node): void {
				if (usedCallees.length === 0) return;

				const resolvedByIdentifier = collectResolvedReferences(context.sourceCode.getScope(node));
				for (const callee of usedCallees) {
					const resolved = resolvedByIdentifier.get(callee);
					if (!resolved) continue;

					const functionNode = getFunctionFromVariable(resolved);
					if (functionNode === undefined || functionsWithReturnValue.has(functionNode)) continue;
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
				if (current !== undefined) {
					functionsWithReturnValue.add(current);
				}
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
