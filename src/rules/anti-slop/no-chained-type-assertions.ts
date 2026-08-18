// oxlint-disable comment-length/limit-single-line-comments -- vendored header
// Vendored from src/rules/no-chained-type-assertions.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path aliases ($oxc-utilities),
// added ParenthesizedExpression unwrapping and const-assertion carve-out.

import { unwrapParenthesis } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isConstAssertion, isTypeAssertionExpression } from "$oxc-utilities/oxc-utilities";

import type { TypeAssertionExpression } from "$oxc-utilities/oxc-utilities";
import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isOutermostAssertionInChain(node: TypeAssertionExpression): boolean {
	let current: ESTree.Expression = node;
	let { parent } = node;

	while (parent.type === "ParenthesizedExpression" && parent.expression === current) {
		current = parent;
		({ parent } = parent);
	}

	return !isTypeAssertionExpression(parent) || parent.expression !== current;
}

function isForbiddenAssertionChain(node: TypeAssertionExpression): boolean {
	let assertionCount = 0;
	let hasNonConstAssertion = false;
	let current: ESTree.Expression = node;

	while (isTypeAssertionExpression(current)) {
		assertionCount += 1;
		hasNonConstAssertion ||= !isConstAssertion(current);
		current = unwrapParenthesis(current.expression);
	}

	return assertionCount > 1 && hasNonConstAssertion;
}

const noChainedTypeAssertions = createRule("no-chained-type-assertion", "anti-slop", {
	createOnce(context): Visitor {
		function checkTypeAssertion(node: TypeAssertionExpression): void {
			if (!isOutermostAssertionInChain(node) || !isForbiddenAssertionChain(node)) return;
			context.report({ messageId: "chained", node });
		}

		return {
			TSAsExpression: checkTypeAssertion,
			TSTypeAssertion: checkTypeAssertion,
		};
	},
	meta: {
		docs: {
			description: "Disallow chained TypeScript as and angle-bracket assertions, including parenthesized chains.",
			recommended: true,
		},
		messages: {
			chained:
				"This assertion chain discards type evidence. Keep the original precise type, or parse untrusted input at its boundary before narrowing it.",
		},
		type: "problem",
	},
});

export default noChainedTypeAssertions;
