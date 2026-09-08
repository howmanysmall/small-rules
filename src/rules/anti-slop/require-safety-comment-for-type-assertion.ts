// Vendored from src/rules/require-safety-comment-for-type-assertion.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases. Adopted configurable markers and non-empty justification text.
// Local departure: a described Oxlint directive that disables
// `typescript/no-unsafe-type-assertion` still counts as justification.

import { createRule } from "$oxc-utilities/create-rule";
import {
	EXPRESSION_STATEMENT,
	isBindingIdentifier,
	isExportNamedDeclaration,
	isProgram,
	isTsTypeReference,
	PROPERTY_DEFINITION,
	RETURN_STATEMENT,
	THROW_STATEMENT,
	VARIABLE_DECLARATION,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, VisitorWithHooks } from "oxlint-plugin-utilities";

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

type SourceCodeComment = ESTree.Comment;

const COMMENT_OWNER_KINDS = new Set([
	EXPRESSION_STATEMENT,
	PROPERTY_DEFINITION,
	RETURN_STATEMENT,
	THROW_STATEMENT,
	VARIABLE_DECLARATION,
]);

const DEFAULT_SAFETY_MARKERS = ["SAFETY"] as const satisfies readonly [string, ...Array<string>];
const MARKER_ESCAPE = /[.*+?^${}()|[\]\\]/gu;
const UNSAFE_ASSERTION_RULE_ID = "typescript/no-unsafe-type-assertion";
const OXLINT_DISABLE_DIRECTIVE = /^oxlint-disable(?:-(?:next-)?line)?(?:\s|$)/u;
const DIRECTIVE_DESCRIPTION_SEPARATOR = /\s-{2,}\s/u;
const DIRECTIVE_VALUE_SEPARATOR = /\s/u;
const COMMA_REGEXP = /[\s,]+/u;

function isConstAssertion(node: TypeAssertion): boolean {
	return (
		isTsTypeReference(node.typeAnnotation) &&
		isBindingIdentifier(node.typeAnnotation.typeName) &&
		node.typeAnnotation.typeName.name === "const"
	);
}

function configuredSafetyMarkers(markers: ReadonlyArray<string> | undefined): readonly [string, ...Array<string>] {
	const [first, ...rest] = markers ?? [];
	if (first === undefined) return DEFAULT_SAFETY_MARKERS;
	return [first, ...rest];
}

function markerPattern(markers: ReadonlyArray<string>): RegExp {
	const alternation = markers.map((marker) => marker.replaceAll(MARKER_ESCAPE, String.raw`\$&`)).join("|");
	return new RegExp(String.raw`(?:^|[^\p{L}\p{N}_])(?:${alternation})\s*:\s*\S`, "u");
}

function disablesUnsafeAssertionRule(comment: SourceCodeComment): boolean {
	const text = comment.value.trim();
	if (!OXLINT_DISABLE_DIRECTIVE.test(text)) return false;

	const divided = text.split(DIRECTIVE_DESCRIPTION_SEPARATOR);
	const [directiveText] = divided;
	const description = divided[1]?.trim();
	if (directiveText === undefined || description === undefined) return false;

	const valueStart = directiveText.search(DIRECTIVE_VALUE_SEPARATOR);
	/* v8 ignore next -- a described directive always contains the kind/value separator. @preserve */
	const value = valueStart === -1 ? "" : directiveText.slice(valueStart);
	for (const ruleId of value.split(COMMA_REGEXP)) if (ruleId === UNSAFE_ASSERTION_RULE_ID) return true;
	return false;
}

function commentJustifiesAssertion(comment: SourceCodeComment, pattern: RegExp): boolean {
	return pattern.test(comment.value) || disablesUnsafeAssertionRule(comment);
}

function hasJustifyingCommentBefore(sourceCode: SourceCode, owner: ESTree.Node, pattern: RegExp): boolean {
	return sourceCode.getCommentsBefore(owner).some((comment) => commentJustifiesAssertion(comment, pattern));
}

function hasSafetyComment(sourceCode: SourceCode, node: TypeAssertion, pattern: RegExp): boolean {
	let current: ESTree.Node = node;
	while (true) {
		if (hasJustifyingCommentBefore(sourceCode, current, pattern)) return true;
		if (COMMENT_OWNER_KINDS.has(current.type)) {
			return (
				isExportNamedDeclaration(current.parent) &&
				current.parent.declaration === current &&
				hasJustifyingCommentBefore(sourceCode, current.parent, pattern)
			);
		}
		if (isProgram(current.parent)) return false;
		current = current.parent;
	}
}

const requireSafetyCommentForTypeAssertion = createRule("require-safety-comment-for-type-assertion", "anti-slop", {
	createOnce(context): VisitorWithHooks {
		let markers: readonly [string, ...Array<string>] = DEFAULT_SAFETY_MARKERS;
		let pattern = markerPattern(markers);

		function checkAssertion(node: TypeAssertion): void {
			if (isConstAssertion(node) || hasSafetyComment(context.sourceCode, node, pattern)) return;
			context.report({ data: { marker: markers[0] }, messageId: "missingSafetyComment", node });
		}

		return {
			before(): void {
				markers = configuredSafetyMarkers(context.options.at(0)?.markers);
				pattern = markerPattern(markers);
			},
			TSAsExpression: checkAssertion,
			TSTypeAssertion: checkAssertion,
		};
	},
	meta: {
		defaultOptions: [{ markers: ["SAFETY"] }],
		docs: {
			description:
				"Require a nearby safety-marker comment (or a described Oxlint suppression of typescript/no-unsafe-type-assertion) for every TypeScript type assertion except const assertions.",
			recommended: true,
		},
		messages: {
			missingSafetyComment:
				"This type assertion has no `{{marker}}:` justification. State the checked invariant immediately before the assertion or its containing statement, or add a described `oxlint-disable-next-line typescript/no-unsafe-type-assertion` directive.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					markers: {
						default: ["SAFETY"],
						description:
							"Comment markers that introduce a justification, written as `MARKER:` followed by non-whitespace text.",
						items: { minLength: 1, type: "string" },
						minItems: 1,
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

export default requireSafetyCommentForTypeAssertion;
