// Vendored from src/rules/no-conditional-empty-object-spread.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path aliases ($oxc-utilities).

import { unwrapParenthesis } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isEmptyObjectExpression } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isConditionalEmptyObjectSpread(node: ESTree.Expression): boolean {
	const conditional = unwrapParenthesis(node);
	return (
		conditional.type === "ConditionalExpression" &&
		(isEmptyObjectExpression(conditional.consequent) || isEmptyObjectExpression(conditional.alternate))
	);
}

const noConditionalEmptyObjectSpread = createRule("no-conditional-empty-object-spread", "anti-slop", {
	createOnce(context): Visitor {
		return {
			SpreadElement(node): void {
				if (node.parent.type !== "ObjectExpression" || !isConditionalEmptyObjectSpread(node.argument)) return;
				context.report({ messageId: "avoid", node });
			},
		};
	},
	meta: {
		docs: {
			description: "Disallow object spreads that conditionally spread an empty object to omit fields.",
			recommended: true,
		},
		messages: {
			avoid: "This conditional spread hides property omission behind an empty object. Build the object in separate statements and add the property only when present.",
		},
		type: "suggestion",
	},
});

export default noConditionalEmptyObjectSpread;
