import { isComponentAssignment, isHookCall } from "$oxc-utilities/lint-utilities";
import { isUppercaseName } from "$oxc-utilities/string-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

const RELATED_USE_STATE_THRESHOLD = 5;
type Context = InferContextFromRule<typeof preferUseReducer>;

function reportExcessiveUseState(context: Context, esTreeNode: ESTree.Node, componentName: string): void {
	/* v8 ignore next -- @preserve rule visitors call this helper only with function block bodies. */
	if (esTreeNode.type !== "BlockStatement") return;
	let useStateCount = 0;
	for (const statement of esTreeNode.body) {
		if (statement.type !== "VariableDeclaration") continue;
		for (const declarator of statement.declarations) {
			if (isHookCall(declarator.init, "useState")) useStateCount += 1;
		}
	}

	if (useStateCount < RELATED_USE_STATE_THRESHOLD) return;
	context.report({
		data: { componentName, useStateCount: String(useStateCount) },
		messageId: "excessiveUseState",
		node: esTreeNode,
	});
}

const preferUseReducer = defineRule({
	create(context): Visitor {
		return {
			FunctionDeclaration(node) {
				if (node.id === null || !isUppercaseName(node.id.name)) return;
				/* v8 ignore next -- @preserve function declarations with component names have parser block bodies. */
				if ("body" in node && node.body) reportExcessiveUseState(context, node.body, node.id.name);
			},
			VariableDeclarator(node) {
				if (!(isComponentAssignment(node) && node.init)) return;
				/* v8 ignore next -- @preserve component assignments matched here have function bodies and identifier names. */
				if ("body" in node.init && node.init.body && "name" in node.id) {
					reportExcessiveUseState(context, node.init.body, node.id.name);
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Suggest using useReducer for related state updates instead of multiple useState calls.",
			recommended: true,
		},
		messages: {
			excessiveUseState:
				'Component "{{componentName}}" has {{useStateCount}} useState calls — consider useReducer for related state',
		},
		type: "problem",
	},
});

export default preferUseReducer;
