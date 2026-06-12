import { getMemberPropertyName, hasShadowedBinding, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

function isTableCreateBase(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type !== "CallExpression" || unwrapped.optional) return false;

	const callee = unwrapExpression(unwrapped.callee);
	if (callee.type !== "MemberExpression" || callee.optional || getMemberPropertyName(callee) !== "create") {
		return false;
	}

	const target = unwrapExpression(callee.object);
	if (target.type !== "Identifier" || target.name !== "table") return false;
	return !hasShadowedBinding(sourceCode, target, "table");
}

function isArrayConstructorBase(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type !== "NewExpression") return false;
	if (unwrapped.arguments.length !== 1 && unwrapped.arguments.length !== 2) return false;

	const callee = unwrapExpression(unwrapped.callee);
	if (callee.type !== "Identifier" || callee.name !== "Array") return false;
	return !hasShadowedBinding(sourceCode, callee, "Array");
}

const noTableCreateMap = defineRule({
	create(context): Visitor {
		return {
			CallExpression(node): void {
				if (node.optional) return;

				const callee = unwrapExpression(node.callee);
				if (callee.type !== "MemberExpression" || callee.optional || getMemberPropertyName(callee) !== "map") {
					return;
				}

				const base = unwrapExpression(callee.object);
				if (
					!(isTableCreateBase(context.sourceCode, base) || isArrayConstructorBase(context.sourceCode, base))
				) {
					return;
				}

				context.report({
					messageId: "avoidConstructThenMap",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow map(...) directly on table.create(...) and new Array(...) constructor patterns in roblox-ts.",
		},
		messages: {
			avoidConstructThenMap:
				"Do not map directly on table.create(...) or new Array(...). Allocate first, then write by index in a loop.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default noTableCreateMap;
