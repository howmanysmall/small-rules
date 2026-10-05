import { defineRule } from "oxlint-plugin-utilities";

import { isStringLiteral } from "../../src/utilities/oxc-utilities.ts";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const EQUALITY_OPERATORS = new Set<string>(["!=", "!==", "==", "==="]);
const WORD_BOUNDARY = /(?<=[a-z\d])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/gu;

export function toConstantName(nodeType: string): string {
	return nodeType.replaceAll(WORD_BOUNDARY, "_").toUpperCase();
}

const preferNodeTypeConstant = defineRule({
	create(context): Visitor {
		const { visitorKeys } = context.sourceCode;

		function check(node: ESTree.Node | null): void {
			if (!isStringLiteral(node)) return;

			const nodeType = node.value;
			if (!Object.hasOwn(visitorKeys, nodeType)) return;

			context.report({
				data: { constant: toConstantName(nodeType), nodeType },
				messageId: "preferConstant",
				node,
			});
		}

		return {
			ArrayExpression({ elements }): void {
				for (const element of elements) check(element);
			},
			BinaryExpression({ left, operator, right }): void {
				if (!EQUALITY_OPERATORS.has(operator)) return;
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
				"Prefer shared node type constants over inline node type strings, so the bundle stores each string once",
		},
		messages: {
			preferConstant:
				'Use `{{constant}}` (or a type guard) from `$oxc-utilities/oxc-utilities` instead of the inline "{{nodeType}}" string.',
		},
		schema: [],
		type: "suggestion",
	},
});

export default preferNodeTypeConstant;
