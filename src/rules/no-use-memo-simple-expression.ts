import { isSimpleExpression } from "$oxc-utilities/component-utilities";
import { isHookCall } from "$oxc-utilities/lint-utilities";
import { getEffectCallback } from "$oxc-utilities/react-hook-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function getReturnExpression(callback: CallbackFunction): ESTree.Expression | undefined {
	/* v8 ignore next -- @preserve callback functions supplied to useMemo have bodies in parsed source. */
	if (callback.body === null) return undefined;
	if (callback.body.type !== "BlockStatement") return callback.body;
	if (callback.body.body.length !== 1) return undefined;

	const [onlyStatement] = callback.body.body;
	if (onlyStatement?.type !== "ReturnStatement") return undefined;
	return onlyStatement.argument ?? undefined;
}

const noUseMemoSimpleExpression = defineRule({
	create(context): Visitor {
		return {
			CallExpression(node): void {
				if (!isHookCall(node, "useMemo")) return;

				const callback = getEffectCallback(node);
				if (callback === undefined) return;

				const returnExpression = getReturnExpression(callback);
				if (returnExpression === undefined || !isSimpleExpression(returnExpression)) return;

				context.report({
					messageId: "simpleMemo",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow useMemo for expressions that are already trivial to compute.",
			recommended: true,
		},
		messages: {
			simpleMemo: "useMemo wrapping a trivially cheap expression - memo overhead exceeds the computation",
		},
		type: "problem",
	},
});

export default noUseMemoSimpleExpression;
