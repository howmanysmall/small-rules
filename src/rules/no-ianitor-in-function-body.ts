import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isIanitorMethodCall({ callee }: ESTree.CallExpression): boolean {
	if (callee.type !== "CallExpression") return false;

	const innerCallee = callee.callee;
	if (innerCallee.type !== "MemberExpression") return false;

	const { object } = innerCallee;
	return object.type === "Identifier" && object.name === "Ianitor";
}

const noIanitorInFunctionBody = defineRule({
	create(context): Visitor {
		let functionDepth = 0;
		function increment(): void {
			functionDepth += 1;
		}
		function decrement(): void {
			functionDepth -= 1;
		}

		return {
			ArrowFunctionExpression: increment,
			"ArrowFunctionExpression:exit": decrement,

			CallExpression(node): void {
				if (functionDepth === 0 || !isIanitorMethodCall(node)) return;

				context.report({
					messageId: "hoistIanitorValidator",
					node,
				});
			},

			FunctionDeclaration: increment,
			"FunctionDeclaration:exit": decrement,

			FunctionExpression: increment,
			"FunctionExpression:exit": decrement,
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow Ianitor validator creation inside function bodies. Hoist to module scope to avoid recreating validators on every call.",
			recommended: true,
		},
		messages: {
			hoistIanitorValidator:
				"Ianitor validator created inside function body is slow — hoist to module scope. Example: const validator = Ianitor.keyOf(ids);",
		},
		schema: [],
		type: "problem",
	},
});

export default noIanitorInFunctionBody;
