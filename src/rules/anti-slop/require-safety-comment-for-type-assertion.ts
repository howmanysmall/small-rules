// Vendored from src/rules/require-safety-comment-for-type-assertion.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path aliases.

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

const COMMENT_OWNER_KINDS = new Set([
	"ExpressionStatement",
	"PropertyDefinition",
	"ReturnStatement",
	"ThrowStatement",
	"VariableDeclaration",
]);

const SAFETY_COMMENT = /\bSAFETY\s*:/u;

function isConstAssertion(node: TypeAssertion): boolean {
	return (
		node.typeAnnotation.type === "TSTypeReference" &&
		node.typeAnnotation.typeName.type === "Identifier" &&
		node.typeAnnotation.typeName.name === "const"
	);
}

function hasSafetyComment(sourceCode: SourceCode, node: TypeAssertion): boolean {
	let current: ESTree.Node = node;
	while (true) {
		if (sourceCode.getCommentsBefore(current).some((comment) => SAFETY_COMMENT.test(comment.value))) {
			return true;
		}
		if (COMMENT_OWNER_KINDS.has(current.type) || current.parent.type === "Program") return false;
		current = current.parent;
	}
}

const requireSafetyCommentForTypeAssertion = createRule("require-safety-comment-for-type-assertion", "anti-slop", {
	createOnce(context): Visitor {
		function checkAssertion(node: TypeAssertion): void {
			if (isConstAssertion(node) || hasSafetyComment(context.sourceCode, node)) return;
			context.report({ messageId: "missingSafetyComment", node });
		}

		return { TSAsExpression: checkAssertion, TSTypeAssertion: checkAssertion };
	},
	meta: {
		docs: {
			description: "Require a nearby SAFETY comment for every TypeScript type assertion except const assertions.",
			recommended: true,
		},
		messages: {
			missingSafetyComment:
				"This type assertion has no `SAFETY:` justification. State the checked invariant immediately before the assertion or its containing statement.",
		},
		type: "problem",
	},
});

export default requireSafetyCommentForTypeAssertion;
