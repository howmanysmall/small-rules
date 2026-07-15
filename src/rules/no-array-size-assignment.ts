import { isAllowAutofixOption } from "$oxc-utilities/option-utilities";
import { isExpressionNode } from "$oxc-utilities/oxc-utilities";
import { ENVIRONMENT_SCHEMA } from "$oxc-utilities/react-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { Environment } from "$oxc-utilities/react-utilities";
import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

type SizeCallExpression = ESTree.CallExpression & {
	readonly callee: ESTree.StaticMemberExpression;
};

function areEquivalentTargets(left: ESTree.Expression, right: ESTree.Expression, sourceCode: SourceCode): boolean {
	if (left.type !== right.type) return false;

	switch (left.type) {
		case "CallExpression":
			return right.type === "CallExpression" && sourceCode.getText(left) === sourceCode.getText(right);

		case "Identifier":
			return right.type === "Identifier" && left.name === right.name;

		case "Literal":
			return right.type === "Literal" && left.value === right.value && left.raw === right.raw;

		case "MemberExpression":
			return right.type === "MemberExpression" && areEquivalentMembers(left, right, sourceCode);

		case "Super":
			return right.type === "Super";

		case "ThisExpression":
			return right.type === "ThisExpression";

		default:
			return false;
	}
}

function areEquivalentMembers(
	left: ESTree.MemberExpression,
	right: ESTree.MemberExpression,
	sourceCode: SourceCode,
): boolean {
	if (left.computed !== right.computed || left.optional !== right.optional) return false;
	if (!areEquivalentTargets(left.object, right.object, sourceCode)) return false;
	return left.computed
		? areEquivalentComputedProperties(left.property, right.property, sourceCode)
		: areEquivalentStaticProperties(left.property, right.property);
}

function areEquivalentComputedProperties(
	left: ESTree.Expression | ESTree.PrivateIdentifier,
	right: ESTree.Expression | ESTree.PrivateIdentifier,
	sourceCode: SourceCode,
): boolean {
	return isExpressionNode(left) && isExpressionNode(right) && areEquivalentTargets(left, right, sourceCode);
}

function areEquivalentStaticProperties(
	left: ESTree.Expression | ESTree.PrivateIdentifier,
	right: ESTree.Expression | ESTree.PrivateIdentifier,
): boolean {
	if (left.type === "PrivateIdentifier" || right.type === "PrivateIdentifier") {
		return left.type === "PrivateIdentifier" && right.type === "PrivateIdentifier" && left.name === right.name;
	}

	return right.type === "Identifier" && left.type === "Identifier" && left.name === right.name;
}

function isSafeMemberAccess(node: ESTree.Expression, allowLiteralRoot: boolean): boolean {
	switch (node.type) {
		case "Identifier":
		case "ThisExpression":
			return true;

		case "Literal":
			return allowLiteralRoot;

		case "MemberExpression": {
			if (node.optional || !isSafeMemberAccess(node.object, false)) return false;
			if (node.computed) {
				/* v8 ignore next -- @preserve computed member properties are expressions in parser output. */
				return isExpressionNode(node.property) ? isSafeMemberAccess(node.property, true) : false;
			}

			return node.property.type === "Identifier" || node.property.type === "PrivateIdentifier";
		}

		default:
			return false;
	}
}

function isSafeFixTarget(node: ESTree.Expression): boolean {
	return isSafeMemberAccess(node, false);
}

function isSizeCall(node: ESTree.Expression): node is SizeCallExpression {
	if (node.type !== "CallExpression") return false;
	/* v8 ignore next -- @preserve optional call chains are wrapped before they can be used as assignment indexes. */
	if (node.optional) return false;
	if (node.arguments.length > 0) return false;
	if (node.callee.type !== "MemberExpression") return false;
	/* v8 ignore next -- @preserve optional member chains are wrapped before they can be used as assignment indexes. */
	if (node.callee.optional) return false;
	if (node.callee.computed) return false;
	if (node.callee.property.type !== "Identifier") return false;
	return node.callee.property.name === "size";
}

function getAppendTarget(
	node: ESTree.AssignmentExpression,
	sourceCode: SourceCode,
	environment: Environment,
): ESTree.MemberExpression | undefined {
	if (node.operator !== "=" || node.left.type !== "MemberExpression" || !node.left.computed) return undefined;

	if (environment === "roblox-ts" && isSizeCall(node.left.property)) {
		return areEquivalentTargets(node.left.object, node.left.property.callee.object, sourceCode)
			? node.left
			: undefined;
	}

	if (environment === "standard") {
		const { property } = node.left;
		if (
			property.type === "MemberExpression" &&
			!property.optional &&
			!property.computed &&
			property.property.type === "Identifier" &&
			property.property.name === "length"
		) {
			return areEquivalentTargets(node.left.object, property.object, sourceCode) ? node.left : undefined;
		}
	}

	return undefined;
}

const noArraySizeAssignment = defineRule({
	create(context): Visitor {
		const [options] = context.options;
		const allowAutofix = isAllowAutofixOption(options) && options.allowAutofix;
		const environment = options?.environment === "standard" ? "standard" : "roblox-ts";
		const { sourceCode } = context;

		return {
			AssignmentExpression(node): void {
				const target = getAppendTarget(node, sourceCode, environment);
				if (target === undefined) return;

				const expressionStatement = node.parent.type === "ExpressionStatement" ? node.parent : undefined;
				const shouldAutofix =
					allowAutofix && expressionStatement !== undefined && isSafeFixTarget(target.object);

				if (!shouldAutofix) {
					context.report({
						messageId: "usePush",
						node,
					});
					return;
				}

				const targetText = sourceCode.getText(target.object);
				const rightText = sourceCode.getText(node.right);

				context.report({
					fix(fixer) {
						return fixer.replaceText(expressionStatement, `${targetText}.push(${rightText});`);
					},
					messageId: "usePush",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow array append assignments using array[array.size()] = value (roblox-ts) or array[array.length] = value (standard) and prefer push-based appends.",
		},
		fixable: "code",
		messages: {
			usePush:
				"Do not append with array[array.size()] = value or array[array.length] = value. Use array.push(value) instead.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowAutofix: {
						default: false,
						description: "Allow the fixer to replace safe append assignments with array.push(value).",
						type: "boolean",
					},
					environment: {
						...ENVIRONMENT_SCHEMA,
						default: "roblox-ts",
						description:
							"Array environment mode: 'roblox-ts' checks array[array.size()]; 'standard' checks array[array.length].",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noArraySizeAssignment;
