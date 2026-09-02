import { createRule } from "$oxc-utilities/create-rule";
import { isCallExpression, isIdentifierName, isMemberExpression } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isIanitorMethodCall({ callee }: ESTree.CallExpression): boolean {
	if (!isCallExpression(callee)) return false;

	const innerCallee = callee.callee;
	if (!isMemberExpression(innerCallee)) return false;

	const { object } = innerCallee;
	return isIdentifierName(object) && object.name === "Ianitor";
}

const noIanitorInFunctionBody = createRule("no-ianitor-in-function-body", "roblox", {
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
