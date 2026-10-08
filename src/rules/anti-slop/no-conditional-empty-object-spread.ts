// Vendored from src/rules/no-conditional-empty-object-spread.ts@c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path aliases ($oxc-utilities).

import { isConditionalExpression, isEmptyObjectExpression, isObjectExpression } from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";
import { stripParenthesis } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isConditionalEmptyObjectSpread(node: ESTree.Expression): boolean {
	const conditional = stripParenthesis(node);
	return (
		isConditionalExpression(conditional) &&
		(isEmptyObjectExpression(conditional.consequent) || isEmptyObjectExpression(conditional.alternate))
	);
}

const noConditionalEmptyObjectSpread = createRule("no-conditional-empty-object-spread", "anti-slop", {
	createOnce(context): Visitor {
		return {
			SpreadElement(node): void {
				if (!isObjectExpression(node.parent) || !isConditionalEmptyObjectSpread(node.argument)) return;
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
