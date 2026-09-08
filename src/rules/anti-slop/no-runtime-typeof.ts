// Vendored from src/rules/no-runtime-typeof.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: local API and path alias adaptation. Existence probes of the
// form `typeof x === "undefined"` are allowed, matching upstream.

import { Predicate } from "effect";

import { createRule } from "$oxc-utilities/create-rule";
import {
	isAnyFunction,
	isBinaryExpression,
	isProgram,
	isStringLiteral,
	isTsTypePredicate,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const EQUALITY_OPERATORS = new Set(["!=", "!==", "==", "==="]);

function isInsideTypeGuard(node: ESTree.Node): boolean {
	let current: ESTree.Node | null = node.parent;
	while (current !== null && !isProgram(current)) {
		if (isAnyFunction(current)) return isTsTypePredicate(current.returnType?.typeAnnotation);
		current = current.parent;
	}
	return false;
}

function isExistenceProbe(node: ESTree.UnaryExpression): boolean {
	const { parent } = node;
	if (!isBinaryExpression(parent) || !EQUALITY_OPERATORS.has(parent.operator)) return false;
	const other = parent.left === node ? parent.right : parent.left;
	return isStringLiteral(other) && other.value === "undefined";
}

const noRuntimeTypeof = createRule("no-runtime-typeof", "anti-slop", {
	createOnce(context): Visitor {
		return {
			UnaryExpression(node): void {
				const [option] = context.options;
				const allowInTypeGuards = Predicate.isObject(option) && option.allowInTypeGuards;
				if (
					node.operator === "typeof" &&
					!isExistenceProbe(node) &&
					(!allowInTypeGuards || !isInsideTypeGuard(node))
				) {
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
