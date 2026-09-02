// Vendored from src/rules/no-runtime-typeof.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: local API and path alias adaptation.

import { Predicate } from "effect";

import { createRule } from "$oxc-utilities/create-rule";
import { isAnyFunction, isProgram, isTsTypePredicate } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isInsideTypeGuard(node: ESTree.Node): boolean {
	let current: ESTree.Node | null = node.parent;
	while (current !== null && !isProgram(current)) {
		if (isAnyFunction(current)) return isTsTypePredicate(current.returnType?.typeAnnotation);
		current = current.parent;
	}
	return false;
}

const noRuntimeTypeof = createRule("no-runtime-typeof", "anti-slop", {
	createOnce(context): Visitor {
		return {
			UnaryExpression(node): void {
				const [option] = context.options;
				const allowInTypeGuards = Predicate.isObject(option) && option.allowInTypeGuards;
				if (node.operator === "typeof" && (!allowInTypeGuards || !isInsideTypeGuard(node))) {
					context.report({ messageId: "runtimeTypeof", node });
				}
			},
		};
	},
	meta: {
		defaultOptions: [{ allowInTypeGuards: false }],
		docs: {
			description:
				"Disallow runtime typeof checks; external values must be decoded into meaningful types at their I/O boundary.",
			recommended: true,
		},
		messages: {
			runtimeTypeof:
				"A `typeof` check narrows a representation without establishing its contract. Parse input at its I/O boundary, then branch on the domain value.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowInTypeGuards: {
						default: false,
						description:
							"Allow `typeof` inside functions whose return type is a type predicate (`value is T`) or an assertion predicate (`asserts value is T`).",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noRuntimeTypeof;
