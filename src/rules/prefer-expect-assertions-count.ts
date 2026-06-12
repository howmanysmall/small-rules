import {
	countExpectCalls,
	getTestCallback,
	isExpectHasAssertionsCall,
	isTestCaseCall,
} from "$oxc-utilities/jest-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { Fix, Visitor } from "oxlint-plugin-utilities";

const preferExpectAssertionsCount = defineRule({
	create(context): Visitor {
		const additionalAssertionFunctions = context.options[0]?.additionalAssertionFunctions ?? [];
		return {
			CallExpression(node): void {
				if (!isTestCaseCall(node)) return;

				const callback = getTestCallback(node);
				if (callback?.body?.type !== "BlockStatement") return;

				const [firstStatement] = callback.body.body;
				if (
					firstStatement?.type !== "ExpressionStatement" ||
					firstStatement.expression.type !== "CallExpression" ||
					!isExpectHasAssertionsCall(firstStatement.expression)
				) {
					return;
				}

				const { deterministic, indeterminate, hasIndeterminate } = countExpectCalls(
					callback.body,
					additionalAssertionFunctions,
				);
				if (hasIndeterminate || indeterminate > 0 || deterministic === 0) return;

				context.report({
					data: { count: String(deterministic) },
					fix(fixer): Fix {
						return fixer.replaceText(firstStatement, `expect.assertions(${deterministic});`);
					},
					messageId: "preferAssertionsCount",
					node: firstStatement.expression,
				});
			},
		};
	},
	meta: {
		docs: {
			description: "Prefer expect.assertions(n) over expect.hasAssertions() when the assertion count is known.",
			recommended: true,
		},
		fixable: "code",
		messages: {
			preferAssertionsCount:
				"Use `expect.assertions({{count}})` instead of `expect.hasAssertions()` when the count is known",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					additionalAssertionFunctions: {
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
	},
});

export default preferExpectAssertionsCount;
