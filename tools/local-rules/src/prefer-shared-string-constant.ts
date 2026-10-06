import { isStringLiteral } from "@small-rules/oxlint-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import { isEqualityOperator } from "./inline-node-types.ts";
import { loadRepositoryUtilities } from "./repository-utilities.ts";

import type { CreateRule, ESTree, Visitor } from "oxlint-plugin-utilities";

import type { UtilitiesIndex } from "./utilities-index.ts";

export function createPreferSharedStringConstantRule(
	getIndex: () => UtilitiesIndex,
): CreateRule<undefined, "useConstant"> {
	return defineRule({
		create(context): Visitor {
			const index = getIndex();

			function check(node: ESTree.Node | null): void {
				if (!isStringLiteral(node)) return;

				const [constant] = index.getConstants(node.value);
				if (constant === undefined) return;

				context.report({
					data: { constant: constant.name, specifier: constant.specifier, value: node.value },
					messageId: "useConstant",
					node,
				});
			}

			return {
				ArrayExpression({ elements }): void {
					for (const element of elements) check(element);
				},
				BinaryExpression({ left, operator, right }): void {
					if (!isEqualityOperator(operator)) return;
					check(left);
					check(right);
				},
				SwitchCase({ test }): void {
					check(test);
				},
			} satisfies Visitor;
		},
		meta: {
			docs: {
				description:
					"Prefer the string constants exported by shared utilities over repeating their values inline, so the bundle stores each string once",
			},
			messages: {
				useConstant: 'Use `{{constant}}` from `{{specifier}}` instead of the inline "{{value}}" string.',
			},
			type: "suggestion",
		},
	});
}

const preferSharedStringConstant = createPreferSharedStringConstantRule(loadRepositoryUtilities);

export default preferSharedStringConstant;
