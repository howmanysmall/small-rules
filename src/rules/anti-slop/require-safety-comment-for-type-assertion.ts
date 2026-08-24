// Vendored from src/rules/require-safety-comment-for-type-assertion.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases. Local departure from the pinned commit: a described Oxlint
// directive that disables `typescript/no-unsafe-type-assertion` counts as a
// safety justification, matching the suppression style enforced by the
// directive rules.

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

type SourceCodeComment = ReturnType<SourceCode["getCommentsBefore"]>[number];

const COMMENT_OWNER_KINDS = new Set([
	"ExpressionStatement",
	"PropertyDefinition",
	"ReturnStatement",
	"ThrowStatement",
	"VariableDeclaration",
]);

const SAFETY_COMMENT = /\bSAFETY\s*:/u;
const UNSAFE_ASSERTION_RULE_ID = "typescript/no-unsafe-type-assertion";
const OXLINT_DISABLE_DIRECTIVE = /^oxlint-disable(?:-(?:next-)?line)?(?:\s|$)/u;
const DIRECTIVE_DESCRIPTION_SEPARATOR = /\s-{2,}\s/u;
const DIRECTIVE_VALUE_SEPARATOR = /\s/u;

function isConstAssertion(node: TypeAssertion): boolean {
	return (
		node.typeAnnotation.type === "TSTypeReference" &&
		node.typeAnnotation.typeName.type === "Identifier" &&
		node.typeAnnotation.typeName.name === "const"
	);
}

/**
 * A described Oxlint suppression of the unsafe-assertion rule documents the
 * same invariant a `SAFETY:` comment would; unrelated or undescribed
 * suppressions do not. Mirrors the directive grammar of `directive-comments`
 * for this one kind.
 */
function disablesUnsafeAssertionRule(comment: SourceCodeComment): boolean {
	const text = comment.value.trim();
	if (!OXLINT_DISABLE_DIRECTIVE.test(text)) return false;

	const divided = text.split(DIRECTIVE_DESCRIPTION_SEPARATOR);
	const directiveText = divided[0];
	const description = divided[1]?.trim();
	if (directiveText === undefined || description === undefined) return false;

	const valueStart = directiveText.search(DIRECTIVE_VALUE_SEPARATOR);
	/* v8 ignore next -- a described directive always contains the kind/value separator. @preserve */
	const value = valueStart === -1 ? "" : directiveText.slice(valueStart);
	for (const ruleId of value.split(/[\s,]+/u)) {
		if (ruleId === UNSAFE_ASSERTION_RULE_ID) return true;
	}
	return false;
}

function isSafetyJustification(comment: SourceCodeComment): boolean {
	return SAFETY_COMMENT.test(comment.value) || disablesUnsafeAssertionRule(comment);
}

function hasSafetyComment(sourceCode: SourceCode, node: TypeAssertion): boolean {
	let current: ESTree.Node = node;
	while (true) {
		if (sourceCode.getCommentsBefore(current).some(isSafetyJustification)) return true;
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
			description:
				"Require a nearby SAFETY comment (or a described Oxlint suppression of typescript/no-unsafe-type-assertion) for every TypeScript type assertion except const assertions.",
			recommended: true,
		},
		messages: {
			missingSafetyComment:
				"This type assertion has no `SAFETY:` justification. State the checked invariant immediately before the assertion or its containing statement, or add a described `oxlint-disable-next-line typescript/no-unsafe-type-assertion` directive.",
		},
		type: "problem",
	},
});

export default requireSafetyCommentForTypeAssertion;
