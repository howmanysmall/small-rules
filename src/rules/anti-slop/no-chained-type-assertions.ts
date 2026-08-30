// Vendored from src/rules/no-chained-type-assertions.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local
// path aliases ($oxc-utilities). Parenthesis unwrapping and the
// const-assertion carve-out match the pinned upstream implementation. Local
// departure: `allowedTargets` exempts a single `as unknown/any/never as T`
// bridge when `T` is a listed identifier (e.g. `vector`, `Vector3`).

import { unwrapParenthesis } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isConstAssertion, isTypeAssertionExpression } from "$oxc-utilities/oxc-utilities";

import type { ESTree, VisitorWithHooks } from "oxlint-plugin-utilities";

import type { TypeAssertionExpression } from "$oxc-utilities/oxc-utilities";

function isOutermostAssertionInChain(node: TypeAssertionExpression): boolean {
	let current: ESTree.Expression = node;
	let { parent } = node;

	while (parent.type === "ParenthesizedExpression" && parent.expression === current) {
		current = parent;
		({ parent } = parent);
	}

	return !isTypeAssertionExpression(parent) || parent.expression !== current;
}

function isTopType(type: ESTree.TSType): boolean {
	return type.type === "TSUnknownKeyword" || type.type === "TSAnyKeyword" || type.type === "TSNeverKeyword";
}

function typeReferenceName(type: ESTree.TSType): string | undefined {
	return type.type === "TSTypeReference" && type.typeName.type === "Identifier" ? type.typeName.name : undefined;
}

const EMPTY_TARGETS: ReadonlyArray<string> = [];

function isForbiddenAssertionChain(node: TypeAssertionExpression, allowedTargets: ReadonlyArray<string>): boolean {
	let assertionCount = 0;
	let hasNonConstAssertion = false;
	let current: ESTree.Expression = node;
	let innerType: ESTree.TSType | undefined;

	while (isTypeAssertionExpression(current)) {
		assertionCount += 1;
		hasNonConstAssertion ||= !isConstAssertion(current);
		if (assertionCount === 2) innerType = current.typeAnnotation;
		current = unwrapParenthesis(current.expression);
	}

	if (!hasNonConstAssertion || assertionCount <= 1) return false;
	if (assertionCount !== 2 || innerType === undefined || !isTopType(innerType)) return true;

	const target = typeReferenceName(node.typeAnnotation);
	return target === undefined || !allowedTargets.includes(target);
}

const noChainedTypeAssertions = createRule("no-chained-type-assertions", "anti-slop", {
	createOnce(context): VisitorWithHooks {
		let allowedTargets: ReadonlyArray<string> = EMPTY_TARGETS;

		function checkTypeAssertion(node: TypeAssertionExpression): void {
			if (!isOutermostAssertionInChain(node) || !isForbiddenAssertionChain(node, allowedTargets)) return;
			context.report({ messageId: "chained", node });
		}

		return {
			before(): void {
				allowedTargets = context.options[0]?.allowedTargets ?? EMPTY_TARGETS;
			},
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
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowedTargets: {
						default: [],
						description:
							"Identifier names allowed as the final target of a single `as unknown/any/never as T` bridge, e.g. `vector` or `Vector3`.",
						items: { type: "string" },
						type: "array",
						uniqueItems: true,
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noChainedTypeAssertions;
