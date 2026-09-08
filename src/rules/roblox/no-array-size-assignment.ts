import { createRule } from "$oxc-utilities/create-rule";
import { isAllowAutofixOption } from "$oxc-utilities/option-utilities";
import {
	CALL_EXPRESSION,
	IDENTIFIER,
	isAnyLiteral,
	isCallExpression,
	isExpressionNode,
	isExpressionStatement,
	isIdentifierName,
	isIdentifierNamed,
	isMemberExpression,
	isPrivateIdentifier,
	isSuper,
	isThisExpression,
	LITERAL,
	MEMBER_EXPRESSION,
	SUPER,
	THIS_EXPRESSION,
} from "$oxc-utilities/oxc-utilities";
import { ENVIRONMENT_SCHEMA } from "$oxc-utilities/react-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { Environment } from "$oxc-utilities/react-utilities";

type SizeCallExpression = ESTree.CallExpression & {
	readonly callee: ESTree.StaticMemberExpression;
};

function areEquivalentTargets(left: ESTree.Expression, right: ESTree.Expression, sourceCode: SourceCode): boolean {
	if (left.type !== right.type) return false;

	switch (left.type) {
		case CALL_EXPRESSION:
			return isCallExpression(right) && sourceCode.getText(left) === sourceCode.getText(right);

		case IDENTIFIER:
			return isIdentifierName(right) && left.name === right.name;

		case LITERAL:
			return isAnyLiteral(right) && left.value === right.value && left.raw === right.raw;

		case MEMBER_EXPRESSION:
			return isMemberExpression(right) && areEquivalentMembers(left, right, sourceCode);

		case SUPER:
			return isSuper(right);

		case THIS_EXPRESSION:
			return isThisExpression(right);

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
	const leftIsPrivate = isPrivateIdentifier(left);
	const rightIsPrivate = isPrivateIdentifier(right);
	if (leftIsPrivate || rightIsPrivate) return leftIsPrivate && rightIsPrivate && left.name === right.name;

	return isIdentifierName(right) && isIdentifierName(left) && left.name === right.name;
}

function isSafeMemberAccess(node: ESTree.Expression, allowLiteralRoot: boolean): boolean {
	switch (node.type) {
		case IDENTIFIER:
		case THIS_EXPRESSION:
			return true;

		case LITERAL:
			return allowLiteralRoot;

		case MEMBER_EXPRESSION: {
			if (node.optional || !isSafeMemberAccess(node.object, false)) return false;
			if (node.computed) {
				/* v8 ignore next -- @preserve computed member properties are expressions in parser output. */
				return isExpressionNode(node.property) ? isSafeMemberAccess(node.property, true) : false;
			}

			return isIdentifierName(node.property) || isPrivateIdentifier(node.property);
		}

		default:
			return false;
	}
}

function isSafeFixTarget(node: ESTree.Expression): boolean {
	return isSafeMemberAccess(node, false);
}

function isSizeCall(node: ESTree.Expression): node is SizeCallExpression {
	return (
		isCallExpression(node) &&
		node.arguments.length === 0 &&
		isMemberExpression(node.callee) &&
		!node.callee.computed &&
		isIdentifierNamed(node.callee.property, "size")
	);
}

function getAppendTarget(
	node: ESTree.AssignmentExpression,
	sourceCode: SourceCode,
	environment: Environment,
): ESTree.MemberExpression | undefined {
	if (node.operator !== "=" || !isMemberExpression(node.left) || !node.left.computed) return undefined;

	if (environment === "roblox-ts" && isSizeCall(node.left.property)) {
		return areEquivalentTargets(node.left.object, node.left.property.callee.object, sourceCode)
			? node.left
			: undefined;
	}

	if (environment === "standard") {
		const { property } = node.left;
		if (
			isMemberExpression(property) &&
			!property.optional &&
			!property.computed &&
			isIdentifierName(property.property) &&
			property.property.name === "length"
		) {
			return areEquivalentTargets(node.left.object, property.object, sourceCode) ? node.left : undefined;
		}
	}

	return undefined;
}

const noArraySizeAssignment = createRule("no-array-size-assignment", "roblox", {
	create(context): Visitor {
		const [options] = context.options;
		const allowAutofix = isAllowAutofixOption(options) && options.allowAutofix;
		const environment = options?.environment === "standard" ? "standard" : "roblox-ts";
		const { sourceCode } = context;

		return {
			AssignmentExpression(node): void {
				const target = getAppendTarget(node, sourceCode, environment);
				if (target === undefined) return;

				const expressionStatement = isExpressionStatement(node.parent) ? node.parent : undefined;
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
