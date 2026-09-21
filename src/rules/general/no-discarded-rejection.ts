import { isNativePromiseExpression } from "$oxc-utilities/api-provenance";
import { hasShadowedBinding } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isBlockStatement,
	isCallbackFunction,
	isIdentifierName,
	isIdentifierNamed,
	isMemberExpression,
	isNumericLiteral,
	isReturnStatement,
	isUnaryExpression,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

function isGlobalUndefined(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	return isIdentifierNamed(expression, "undefined") && !hasShadowedBinding(sourceCode, expression, "undefined");
}

function isVoidZero(expression: ESTree.Expression): boolean {
	return (
		isUnaryExpression(expression) &&
		expression.operator === "void" &&
		isNumericLiteral(expression.argument) &&
		expression.argument.value === 0
	);
}

function isUndefinedExpression(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	return isGlobalUndefined(sourceCode, expression) || isVoidZero(expression);
}

function isDiscardingHandler(sourceCode: SourceCode, handler: ESTree.Expression): boolean {
	if (!isCallbackFunction(handler) || handler.params.some((parameter) => !isIdentifierName(parameter))) return false;

	const { body } = handler;
	/* v8 ignore next -- callback expressions always have a body. @preserve */
	if (body === null) return false;

	if (!isBlockStatement(body)) return isUndefinedExpression(sourceCode, body);
	if (body.body.length === 0) return true;
	if (body.body.length !== 1) return false;

	const [statement] = body.body;
	if (!isReturnStatement(statement)) return false;

	return statement.argument === null || isUndefinedExpression(sourceCode, statement.argument);
}

const noDiscardedRejection = createRule("no-discarded-rejection", "general", {
	create(context): Visitor {
		const { sourceCode } = context;
		return {
			CallExpression(node): void {
				const { callee } = node;
				if (!isMemberExpression(callee) || callee.computed || !isIdentifierNamed(callee.property, "catch")) {
					return;
				}
				if (!isNativePromiseExpression(sourceCode, callee.object)) return;
				const [handler] = node.arguments;
				if (
					handler === undefined ||
					handler.type === "SpreadElement" ||
					!isDiscardingHandler(sourceCode, handler)
				) {
					return;
				}
				context.report({ messageId: "noDiscardedRejection", node: handler });
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Warn when a Promise rejection handler explicitly discards the failure and resolves to undefined.",
		},
		messages: {
			noDiscardedRejection:
				"This rejection handler discards the failure without recording it or recovering from it.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default noDiscardedRejection;
