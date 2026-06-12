import { getMemberPropertyName, getVariableByName } from "$oxc-utilities/ast-utilities";
import { getHookName } from "$oxc-utilities/react-hook-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

const DEFAULT_BINDING_PATTERNS: ReadonlyArray<string> = ["binding"];

function getParameterName(parameterPattern: ESTree.ParamPattern): string | undefined {
	if (parameterPattern.type === "Identifier") return parameterPattern.name;
	if (parameterPattern.type === "AssignmentPattern" && parameterPattern.left.type === "Identifier") {
		return parameterPattern.left.name;
	}
	return undefined;
}

function isBlockReturningIdentity({ body }: ESTree.FunctionBody, parameterName: string): boolean {
	if (body.length !== 1) return false;

	const [statement] = body;
	if (statement?.type !== "ReturnStatement" || statement.argument?.type !== "Identifier") {
		return false;
	}

	return statement.argument.name === parameterName;
}

function isIdentityCallback(callback: ESTree.Expression): boolean {
	if (callback.type === "ArrowFunctionExpression") {
		if (callback.params.length !== 1) return false;

		const [parameter] = callback.params;
		if (parameter === undefined) return false;

		const name = getParameterName(parameter);
		if (name === undefined) return false;

		const { body } = callback;
		switch (body.type) {
			case "BlockStatement":
				return isBlockReturningIdentity(body, name);

			case "Identifier":
				return body.name === name;

			default:
				return false;
		}
	}

	if (callback.type === "FunctionExpression") {
		if (callback.params.length !== 1) return false;

		const [parameter] = callback.params;
		if (parameter === undefined) return false;

		const name = getParameterName(parameter);
		if (name === undefined || callback.body === null) return false;
		return isBlockReturningIdentity(callback.body, name);
	}

	return false;
}

function isJoinBindingsCall(node: ESTree.CallExpression): boolean {
	return getHookName(node) === "joinBindings";
}

function isBindingInitialization(variable: ScopeVariable): boolean {
	for (const definition of variable.defs) {
		if (definition.node.type !== "VariableDeclarator") continue;

		const { init } = definition.node;
		if (init?.type !== "CallExpression") continue;

		const calleeName = getHookName(init);
		if (
			calleeName === "useBinding" ||
			isJoinBindingsCall(init) ||
			(init.callee.type === "MemberExpression" && getMemberPropertyName(init.callee) === "map")
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
	if (object.type === "Identifier") {
		const lowerName = object.name.toLowerCase();
		for (const pattern of patterns) if (lowerName.includes(pattern.toLowerCase())) return true;

		const variable = getVariableByName(sourceCode.getScope(object), object.name);
		if (variable !== undefined && isBindingInitialization(variable)) return true;
	}

	return (
		object.type === "CallExpression" &&
		((object.callee.type === "MemberExpression" && getMemberPropertyName(object.callee) === "map") ||
			isJoinBindingsCall(object))
	);
}

const noIdentityMap = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;
		const [options] = context.options;
		const bindingPatterns = options?.bindingPatterns ?? DEFAULT_BINDING_PATTERNS;

		return {
			CallExpression(node): void {
				const { callee } = node;
				if (
					callee.type !== "MemberExpression" ||
					callee.computed ||
					callee.property.type !== "Identifier" ||
					getMemberPropertyName(callee) !== "map" ||
					node.arguments.length !== 1
				) {
					return;
				}

				const [argument] = node.arguments;
				if (argument === undefined || argument.type === "SpreadElement" || !isIdentityCallback(argument)) {
					return;
				}

				const binding = isLikelyBinding(sourceCode, callee, bindingPatterns);
				context.report({
					fix(fixer) {
						return fixer.replaceText(node, sourceCode.getText(callee.object));
					},
					messageId: binding ? "identityBindingMap" : "identityArrayMap",
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
