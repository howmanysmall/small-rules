import {
	isArrayExpression,
	isAwaitExpression,
	isBlockStatement,
	isCallbackFunction,
	isCallExpression,
	isExpressionStatement,
	isIdentifier,
	isMemberExpression,
	isObjectExpression,
	isReturnStatement,
	isSpreadElement,
	isUnaryExpression,
} from "@small-rules/oxlint-utilities";

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import {
	COMMAND_FACTORIES_PROPERTY,
	createCommandMatcher,
	DEFAULT_COMMAND_FACTORIES,
} from "$oxc-utilities/cliffy-command";
import { createRule } from "$oxc-utilities/create-rule";
import { getMethodCallee } from "$oxc-utilities/member-callee";
import { stripExpressionWrappers } from "$oxc-utilities/oxc-utilities";
import { getSingleDefinition } from "$oxc-utilities/single-variable-definition";

import type { ESTree, SourceCode, VisitorWithHooks } from "oxlint-plugin-utilities";

import type { CommandMatcher } from "$oxc-utilities/cliffy-command";

type ForwardedValue = ESTree.Expression | ESTree.SpreadElement;

type Handler = ESTree.ArrowFunctionExpression | ESTree.Function;

function getSoleExpression({ body }: Handler): ESTree.Expression | null | undefined {
	if (!isBlockStatement(body)) return body;

	const statement = body.body.length === 1 ? body.body[0] : undefined;
	if (isExpressionStatement(statement)) return statement.expression;
	return isReturnStatement(statement) ? statement.argument : undefined;
}

function getSoleCall(handler: Handler): ESTree.CallExpression | undefined {
	const expression = getSoleExpression(handler);
	if (expression === null || expression === undefined) return undefined;

	let current = stripExpressionWrappers(expression);
	while (isAwaitExpression(current) || (isUnaryExpression(current) && current.operator === "void")) {
		current = stripExpressionWrappers(current.argument);
	}

	return isCallExpression(current) ? current : undefined;
}

function appendObjectParts({ properties }: ESTree.ObjectExpression, worklist: Array<ForwardedValue>): boolean {
	for (const property of properties) {
		if (isSpreadElement(property)) {
			worklist.push(property);
		} else if (property.computed) {
			return false;
		} else {
			worklist.push(property.value);
		}
	}

	return true;
}

function appendArrayParts({ elements }: ESTree.ArrayExpression, worklist: Array<ForwardedValue>): boolean {
	for (const element of elements) {
		if (element === null) return false;
		worklist.push(element);
	}

	return true;
}

/**
 * Queues the values a forwarded argument is built from.
 *
 * @param expression - An argument, or a part of one, that isn't an identifier.
 * @param worklist - Receives the values still to check.
 * @returns False when the expression computes something instead of passing it
 *   along.
 */
function appendForwardedParts(expression: ESTree.Expression, worklist: Array<ForwardedValue>): boolean {
	if (isObjectExpression(expression)) return appendObjectParts(expression, worklist);
	if (isArrayExpression(expression)) return appendArrayParts(expression, worklist);
	if (!isMemberExpression(expression) || expression.computed) return false;

	worklist.push(expression.object);
	return true;
}

function isParameterOf(sourceCode: SourceCode, identifier: ESTree.IdentifierReference, handler: Handler): boolean {
	const definition = getSingleDefinition(getVariableByName(sourceCode.getScope(identifier), identifier.name));
	return definition?.type === "Parameter" && definition.node === handler;
}

/**
 * Whether every argument is built from nothing but the handler's parameters. A
 * literal or an outside variable means the call adds something, so it isn't
 * pure forwarding.
 *
 * @param sourceCode - Resolves each identifier to its definition.
 * @param call - The only call in the handler.
 * @param handler - Owns the parameters that may be passed along.
 * @returns Whether the call only passes along what the handler received.
 */
function forwardsOnlyParameters(sourceCode: SourceCode, call: ESTree.CallExpression, handler: Handler): boolean {
	const worklist: Array<ForwardedValue> = [...call.arguments];
	for (const value of worklist) {
		const expression = stripExpressionWrappers(isSpreadElement(value) ? value.argument : value);
		if (isIdentifier(expression)) {
			if (!isParameterOf(sourceCode, expression, handler)) return false;
		} else if (!appendForwardedParts(expression, worklist)) {
			return false;
		}
	}

	return true;
}

const noCliffyActionWrapper = createRule("no-cliffy-action-wrapper", "cliffy", {
	createOnce(context): VisitorWithHooks {
		let matcher: CommandMatcher;

		/**
		 * Finds the function a handler forwards to. A global or a parameter has no
		 * implementation here or in an import to move into the handler.
		 *
		 * @param handler - The `.action` handler.
		 * @returns The name of the function, when the handler only forwards to it.
		 */
		function getForwardTarget(handler: Handler): string | undefined {
			const call = getSoleCall(handler);
			if (call === undefined || call.optional || !isIdentifier(call.callee)) return undefined;

			const { sourceCode } = context;
			const definition = getSingleDefinition(
				getVariableByName(sourceCode.getScope(call.callee), call.callee.name),
			);

			if (definition === undefined || definition.type === "Parameter") return undefined;

			return forwardsOnlyParameters(sourceCode, call, handler) ? call.callee.name : undefined;
		}

		return {
			before(): void {
				matcher = createCommandMatcher(
					context.sourceCode,
					context.options[0]?.factories ?? DEFAULT_COMMAND_FACTORIES,
				);
			},
			CallExpression(node): void {
				const callee = getMethodCallee(node, "action");
				if (callee === undefined) return;

				const [handler] = node.arguments;
				if (!isCallbackFunction(handler)) return;

				const name = getForwardTarget(handler);
				if (name !== undefined && matcher.isCommand(callee.object)) {
					context.report({ data: { name }, messageId: "actionWrapper", node: handler });
				}
			},
		} satisfies VisitorWithHooks;
	},
	meta: {
		docs: {
			description: "Disallow Cliffy `.action` handlers that only forward their arguments to another function.",
		},
		messages: {
			actionWrapper:
				"This handler only forwards to `{{name}}`. Put the implementation in the handler, where Cliffy already infers the option and argument types.",
		},
		schema: [
			{
				additionalProperties: false,
				default: { factories: DEFAULT_COMMAND_FACTORIES },
				properties: { factories: COMMAND_FACTORIES_PROPERTY },
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default noCliffyActionWrapper;
