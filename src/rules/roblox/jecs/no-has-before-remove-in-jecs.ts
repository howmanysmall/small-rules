import { isJecsWorldExpression } from "$oxc-utilities/api-provenance";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isBlockStatement,
	isCallExpression,
	isExpressionStatement,
	isIdentifierName,
	isIdentifierNamed,
	isIfStatement,
	isLiteral,
	isMemberExpression,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

function getMethodCall(expression: ESTree.Expression, name: "has" | "remove"): ESTree.CallExpression | undefined {
	if (!isCallExpression(expression)) return undefined;
	const { callee } = expression;
	if (!isMemberExpression(callee) || callee.computed || !isIdentifierNamed(callee.property, name)) return undefined;
	return expression;
}

function getOnlyExpression(statement: ESTree.Statement): ESTree.Expression | undefined {
	if (isExpressionStatement(statement)) return statement.expression;
	if (!isBlockStatement(statement) || statement.body.length !== 1) return undefined;
	const [onlyStatement] = statement.body;
	return isExpressionStatement(onlyStatement) ? onlyStatement.expression : undefined;
}

function expressionsMatch(sourceCode: SourceCode, left: ESTree.Expression, right: ESTree.Expression): boolean {
	return sourceCode.getText(left) === sourceCode.getText(right);
}

function isStableExpression(expression: ESTree.Expression): boolean {
	return isIdentifierName(expression) || isLiteral(expression);
}

interface RemovalGuard {
	readonly hasCall: ESTree.CallExpression;
	readonly removeCall: ESTree.CallExpression;
}

function callsHaveMatchingArguments(sourceCode: SourceCode, guard: RemovalGuard): boolean {
	if (guard.hasCall.arguments.length !== 2 || guard.removeCall.arguments.length !== 2) return false;
	for (let index = 0; index < guard.hasCall.arguments.length; index += 1) {
		const hasArgument = guard.hasCall.arguments[index];
		const removeArgument = guard.removeCall.arguments[index];
		/* v8 ignore next -- equal two-element lengths prove both elements exist. @preserve */
		if (hasArgument === undefined || removeArgument === undefined) return false;
		if (hasArgument.type === "SpreadElement" || removeArgument.type === "SpreadElement") return false;
		if (!expressionsMatch(sourceCode, hasArgument, removeArgument)) return false;
	}
	return true;
}

function getRemovalGuard(sourceCode: SourceCode, node: ESTree.IfStatement): RemovalGuard | undefined {
	if (node.alternate !== null) return undefined;
	const hasCall = getMethodCall(node.test, "has");
	const removalExpression = getOnlyExpression(node.consequent);
	if (hasCall === undefined || removalExpression === undefined) return undefined;
	const removeCall = getMethodCall(removalExpression, "remove");
	if (removeCall === undefined) return undefined;
	const hasMember = hasCall.callee;
	const removeMember = removeCall.callee;
	/* v8 ignore next -- getMethodCall only returns statically named member calls. @preserve */
	if (!isMemberExpression(hasMember) || !isMemberExpression(removeMember)) return undefined;
	if (!expressionsMatch(sourceCode, hasMember.object, removeMember.object)) return undefined;
	if (!isJecsWorldExpression(sourceCode, hasMember.object)) return undefined;
	const guard = { hasCall, removeCall };
	return callsHaveMatchingArguments(sourceCode, guard) ? guard : undefined;
}

function isSafeToFix(guard: RemovalGuard): boolean {
	/* v8 ignore next -- getMethodCall only returns statically named member calls. @preserve */
	if (!isMemberExpression(guard.hasCall.callee) || !isStableExpression(guard.hasCall.callee.object)) return false;
	return guard.hasCall.arguments.every(
		(argument) => argument.type !== "SpreadElement" && isStableExpression(argument),
	);
}

const noHasBeforeRemoveInJecs = createRule("no-has-before-remove-in-jecs", "roblox/jecs", {
	create(context): Visitor {
		const { sourceCode } = context;
		return {
			IfStatement(node): void {
				/* v8 ignore next -- the visitor only receives IfStatement nodes. @preserve */
				if (!isIfStatement(node)) return;
				const guard = getRemovalGuard(sourceCode, node);
				if (guard === undefined) return;
				if (isSafeToFix(guard)) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, `${sourceCode.getText(guard.removeCall)};`),
						messageId: "removeWithoutHas",
						node,
					});
				} else context.report({ messageId: "removeWithoutHas", node });
			},
		} satisfies Visitor;
	},
	meta: {
		docs: { description: "Disallow redundant Jecs World.has guards around World.remove calls." },
		fixable: "code",
		messages: { removeWithoutHas: "Jecs World.remove already handles an absent component." },
		schema: [] as const,
		type: "problem",
	},
});

export default noHasBeforeRemoveInJecs;
