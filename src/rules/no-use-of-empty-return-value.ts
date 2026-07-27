import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { isAnyFunction } from "$oxc-utilities/oxc-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Variable, Visitor } from "oxlint-plugin-utilities";

type FunctionLike = ESTree.ArrowFunctionExpression | ESTree.Function;

function parentUsesValue(parent: ESTree.Node, child: ESTree.Node): boolean {
	if (parent.type === "LogicalExpression") return parent.left === child;
	if (parent.type === "ConditionalExpression") return parent.test === child;
	if (parent.type === "SequenceExpression") {
		const last = parent.expressions.at(-1);
		if (last !== child) return false;
		const { parent: grandParent } = parent;
		return grandParent !== null && parentUsesValue(grandParent, parent);
	}
	return (
		parent.type !== "ExpressionStatement" &&
		parent.type !== "ArrowFunctionExpression" &&
		parent.type !== "UnaryExpression" &&
		parent.type !== "AwaitExpression" &&
		parent.type !== "ReturnStatement" &&
		parent.type !== "ThrowStatement"
	);
}

function callReturnValueIsUsed(callExpression: ESTree.CallExpression): boolean {
	const { parent } = callExpression;
	return parent !== null && parentUsesValue(parent, callExpression);
}

function functionFromVariable(variable: Variable): FunctionLike | undefined {
	if (variable.defs.length !== 1) return undefined;
	const [definition] = variable.defs;
	/* v8 ignore next -- length === 1 guarantees a definition entry. @preserve */
	if (definition === undefined) return undefined;
	if (definition.type === "FunctionName" && isAnyFunction(definition.node)) return definition.node;
	if (
		definition.type === "Variable" &&
		definition.node.type === "VariableDeclarator" &&
		definition.node.init !== null &&
		(definition.node.init.type === "FunctionExpression" || definition.node.init.type === "ArrowFunctionExpression")
	) {
		return definition.node.init;
	}
	return undefined;
}

const noUseOfEmptyReturnValue = defineRule({
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
			if (node.type === "ArrowFunctionExpression" && node.expression) {
				functionsWithReturnValue.add(node);
			}
		}

		function exitFunction(): void {
			functionStack.pop();
		}

		return {
			ArrowFunctionExpression: enterFunction,
			"ArrowFunctionExpression:exit": exitFunction,
			CallExpression(node): void {
				if (!callReturnValueIsUsed(node)) return;
				if (node.callee.type !== "Identifier") return;

				const scope = context.sourceCode.getScope(node);
				const reference = scope.references.find((entry) => entry.identifier === node.callee);
				const resolved = reference?.resolved ?? getVariableByName(scope, node.callee.name);
				if (resolved === null || resolved === undefined) return;
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
				if (node.argument === null || node.argument === undefined) return;
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
