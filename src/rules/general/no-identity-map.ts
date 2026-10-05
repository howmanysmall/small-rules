import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	BLOCK_STATEMENT,
	getMemberPropertyName,
	IDENTIFIER,
	isArrowFunctionExpression,
	isAssignmentPattern,
	isCallExpression,
	isFunctionExpression,
	isIdentifierName,
	isMemberExpression,
	isReturnStatement,
	isSpreadElement,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";
import { getHookName } from "$oxc-utilities/react-hook-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

const DEFAULT_BINDING_PATTERNS: ReadonlyArray<string> = ["binding"];

function getParameterName(parameterPattern: ESTree.ParamPattern): string | undefined {
	if (isIdentifierName(parameterPattern)) return parameterPattern.name;
	if (isAssignmentPattern(parameterPattern) && isIdentifierName(parameterPattern.left)) {
		return parameterPattern.left.name;
	}
	return undefined;
}

function isBlockReturningIdentity({ body }: ESTree.FunctionBody, parameterName: string): boolean {
	if (body.length !== 1) return false;

	const [statement] = body;
	if (!isReturnStatement(statement) || !isIdentifierName(statement.argument)) {
		return false;
	}

	return statement.argument.name === parameterName;
}

function getSingleParameterName(callback: { readonly params: ReadonlyArray<ESTree.ParamPattern> }): string | undefined {
	if (callback.params.length !== 1) return undefined;

	const [parameter] = callback.params;
	/* v8 ignore next -- params length check guarantees a dense first parameter slot in parser output. @preserve */
	return parameter === undefined ? undefined : getParameterName(parameter);
}

function isIdentityCallback(callback: ESTree.Expression): boolean {
	if (isArrowFunctionExpression(callback)) {
		const name = getSingleParameterName(callback);
		if (name === undefined) return false;

		const { body } = callback;
		switch (body.type) {
			case BLOCK_STATEMENT:
				return isBlockReturningIdentity(body, name);

			case IDENTIFIER:
				return body.name === name;

			default:
				return false;
		}
	}

	if (isFunctionExpression(callback)) {
		const name = getSingleParameterName(callback);
		if (name === undefined || callback.body === null) return false;
		return isBlockReturningIdentity(callback.body, name);
	}

	/* v8 ignore next -- non-function callbacks are handled as a non-identity public path. @preserve */
	return false;
}

function isJoinBindingsCall(node: ESTree.CallExpression): boolean {
	return getHookName(node) === "joinBindings";
}

function isBindingInitialization(variable: ScopeVariable): boolean {
	for (const definition of variable.defs) {
		if (!isVariableDeclarator(definition.node)) continue;

		const { init } = definition.node;
		if (!isCallExpression(init)) continue;

		const calleeName = getHookName(init);
		if (
			calleeName === "useBinding" ||
			isJoinBindingsCall(init) ||
			(isMemberExpression(init.callee) && getMemberPropertyName(init.callee) === "map")
		) {
			return true;
		}
	}
	return false;
}

function isLikelyBinding(
	sourceCode: SourceCode,
	{ object }: ESTree.MemberExpression,
	patterns: ReadonlyArray<string>,
): boolean {
	if (isIdentifierName(object)) {
		const lowerName = object.name.toLowerCase();
		for (const pattern of patterns) if (lowerName.includes(pattern.toLowerCase())) return true;

		const variable = getVariableByName(sourceCode.getScope(object), object.name);
		if (variable !== undefined && isBindingInitialization(variable)) return true;
	}

	return (
		isCallExpression(object) &&
		((isMemberExpression(object.callee) && getMemberPropertyName(object.callee) === "map") ||
			isJoinBindingsCall(object))
	);
}

function getIdentityMapCallee(node: ESTree.Node): ESTree.MemberExpression | undefined {
	if (node.type !== "CallExpression") return undefined;

	const { callee } = node;
	if (
		!isMemberExpression(callee) ||
		callee.computed ||
		!isIdentifierName(callee.property) ||
		getMemberPropertyName(callee) !== "map" ||
		node.arguments.length !== 1
	) {
		return undefined;
	}

	const [argument] = node.arguments;
	if (argument === undefined || isSpreadElement(argument) || !isIdentityCallback(argument)) {
		return undefined;
	}

	return callee;
}

function isReceiverOfIdentityMap(node: ESTree.CallExpression): boolean {
	const { parent } = node;
	return isMemberExpression(parent) && parent.object === node && getIdentityMapCallee(parent.parent) === parent;
}

const noIdentityMap = createRule("no-identity-map", "general", {
	create(context): Visitor {
		const { sourceCode } = context;
		const [options] = context.options;
		const bindingPatterns = options?.bindingPatterns ?? DEFAULT_BINDING_PATTERNS;

		return {
			CallExpression(node): void {
				const callee = getIdentityMapCallee(node);
				if (callee === undefined) return;

				const messageId = isLikelyBinding(sourceCode, callee, bindingPatterns)
					? "identityBindingMap"
					: "identityArrayMap";

				// The outermost identity map of a chain fixes the whole chain, so
				// it settles in one pass instead of one pass per call.
				if (isReceiverOfIdentityMap(node)) {
					context.report({ messageId, node });
					return;
				}

				let receiver = callee.object;
				for (
					let inner = getIdentityMapCallee(receiver);
					inner !== undefined;
					inner = getIdentityMapCallee(receiver)
				) {
					receiver = inner.object;
				}

				context.report({
					fix(fixer) {
						return fixer.replaceText(node, sourceCode.getText(receiver));
					},
					messageId,
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow pointless identity `.map()` calls that return the parameter unchanged",
		},
		fixable: "code",
		messages: {
			identityArrayMap:
				"Pointless identity `.map()` call on Array. Use `table.clone(array)` or `[...array]` instead.",
			identityBindingMap: "Pointless identity `.map()` call on Binding. Use the original binding directly.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					bindingPatterns: {
						default: [...DEFAULT_BINDING_PATTERNS],
						description: "Variable name patterns to recognize as Bindings (case insensitive)",
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default noIdentityMap;
