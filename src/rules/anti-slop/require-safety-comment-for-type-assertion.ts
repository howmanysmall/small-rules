// Vendored from src/rules/require-safety-comment-for-type-assertion.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases. Adopted configurable markers and non-empty justification text.
// Local departure: a described Oxlint directive that disables
// `typescript/no-unsafe-type-assertion` still counts as justification.
// Local departure: an unbraced control-flow body may take its justification
// from the leading comment of the enclosing statement.
// Local departure: oxlint-tsgolint 7.0.2002 reports on assertion syntax, so a
// disable must cover that line. `settings["small-rules"].tsgolintVersion`
// selects the range; when it is absent the rule infers from node_modules,
// pnpm-workspace.yaml, or package.json.

import nodePath from "node:path";

import { createRule } from "$oxc-utilities/create-rule";
import { parseDirectiveComment } from "$oxc-utilities/directive-comments";
import {
	EXPRESSION_STATEMENT,
	isBindingIdentifier,
	isExportNamedDeclaration,
	isProgram,
	isTsTypeReference,
	isUnbracedControlBody,
	PROPERTY_DEFINITION,
	RETURN_STATEMENT,
	THROW_STATEMENT,
	VARIABLE_DECLARATION,
} from "$oxc-utilities/oxc-utilities";
import {
	isLintSettings,
	resolveTsgoLintVersion,
	usesAssertionSyntaxDiagnosticRange,
} from "$oxc-utilities/tsgolint-version";

import type { ESTree, SourceCode, VisitorWithHooks } from "oxlint-plugin-utilities";

import type { DirectiveComment } from "$oxc-utilities/directive-comments";

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
const OXLINT_DISABLE = "oxlint-disable";
const OXLINT_DISABLE_LINE = "oxlint-disable-line";
const OXLINT_DISABLE_NEXT_LINE = "oxlint-disable-next-line";
const COMMA_REGEXP = /[\s,]+/u;

function isConstAssertion(node: TypeAssertion): boolean {
	return (
		isTsTypeReference(node.typeAnnotation) &&
		isBindingIdentifier(node.typeAnnotation.typeName) &&
		node.typeAnnotation.typeName.name === "const"
	);
}

function configuredSafetyMarkers(markers?: ReadonlyArray<string>): readonly [string, ...Array<string>] {
	const [first, ...rest] = markers ?? [];
	if (first === undefined) return DEFAULT_SAFETY_MARKERS;
	return [first, ...rest];
}

function markerPattern(markers: ReadonlyArray<string>): RegExp {
	const alternation = markers.map((marker) => marker.replaceAll(MARKER_ESCAPE, String.raw`\$&`)).join("|");
	return new RegExp(String.raw`(?:^|[^\p{L}\p{N}_])(?:${alternation})\s*:\s*\S`, "u");
}

function parsedUnsafeAssertionDisable(comment: SourceCodeComment): DirectiveComment | undefined {
	const parsed = parseDirectiveComment(comment);

	if (
		parsed?.description === undefined ||
		(parsed.kind !== OXLINT_DISABLE &&
			parsed.kind !== OXLINT_DISABLE_LINE &&
			parsed.kind !== OXLINT_DISABLE_NEXT_LINE) ||
		!valueHasUnsafeAssertionRule(parsed.value)
	) {
		return undefined;
	}
	return parsed;
}

function valueHasUnsafeAssertionRule(value?: string): boolean {
	/* v8 ignore next -- parseDirectiveComment always includes a value string. @preserve */
	if (value === undefined) return false;
	for (const ruleId of value.split(COMMA_REGEXP)) if (ruleId === UNSAFE_ASSERTION_RULE_ID) return true;
	return false;
}

function disablesUnsafeAssertionRule(comment: SourceCodeComment): boolean {
	return parsedUnsafeAssertionDisable(comment) !== undefined;
}

function disableKindCoversLine(kind: string, comment: SourceCodeComment, line: number): boolean {
	if (kind === OXLINT_DISABLE_NEXT_LINE) return comment.loc.end.line + 1 === line;
	if (kind === OXLINT_DISABLE_LINE) return comment.loc.start.line === line;
	return comment.loc.end.line <= line;
}

function hasJustifyingCommentBefore(
	sourceCode: SourceCode,
	owner: ESTree.Node,
	isJustifying: (comment: SourceCodeComment) => boolean,
): boolean {
	return sourceCode.getCommentsBefore(owner).some(isJustifying);
}

function hasCommentBeforeAncestors(
	sourceCode: SourceCode,
	node: TypeAssertion,
	isJustifying: (comment: SourceCodeComment) => boolean,
): boolean {
	let current: ESTree.Node = node;
	while (true) {
		if (hasJustifyingCommentBefore(sourceCode, current, isJustifying)) return true;
		if (COMMENT_OWNER_KINDS.has(current.type) && !isUnbracedControlBody(current)) {
			return (
				isExportNamedDeclaration(current.parent) &&
				current.parent.declaration === current &&
				hasJustifyingCommentBefore(sourceCode, current.parent, isJustifying)
			);
		}
		if (isProgram(current.parent)) return false;
		current = current.parent;
	}
}

function hasDisableCoveringAssertionLine(sourceCode: SourceCode, node: TypeAssertion): boolean {
	const { line } = node.typeAnnotation.loc.start;
	for (const comment of sourceCode.getAllComments()) {
		const parsed = parsedUnsafeAssertionDisable(comment);
		if (parsed !== undefined && disableKindCoversLine(parsed.kind, comment, line)) return true;
	}
	return false;
}

function hasSafetyComment(
	sourceCode: SourceCode,
	node: TypeAssertion,
	pattern: RegExp,
	assertionSyntaxRange: boolean,
): boolean {
	if (hasCommentBeforeAncestors(sourceCode, node, (comment) => pattern.test(comment.value))) return true;
	if (assertionSyntaxRange) return hasDisableCoveringAssertionLine(sourceCode, node);
	return hasCommentBeforeAncestors(sourceCode, node, disablesUnsafeAssertionRule);
}

const requireSafetyCommentForTypeAssertion = createRule("require-safety-comment-for-type-assertion", "anti-slop", {
	createOnce(context): VisitorWithHooks {
		let markers: readonly [string, ...Array<string>] = DEFAULT_SAFETY_MARKERS;
		let pattern = markerPattern(markers);
		let assertionSyntaxRange = false;

		function checkAssertion(node: TypeAssertion): void {
			if (isConstAssertion(node) || hasSafetyComment(context.sourceCode, node, pattern, assertionSyntaxRange)) {
				return;
			}
			context.report({ data: { marker: markers[0] }, messageId: "missingSafetyComment", node });
		}

		return {
			before(): void {
				markers = configuredSafetyMarkers(context.options.at(0)?.markers);
				pattern = markerPattern(markers);
				const settings = isLintSettings.allows(context.settings) ? context.settings : undefined;
				assertionSyntaxRange = usesAssertionSyntaxDiagnosticRange(
					resolveTsgoLintVersion(settings, nodePath.dirname(context.filename)),
				);
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
				"This type assertion has no `{{marker}}:` justification. State the checked invariant immediately before the assertion or its containing statement, or add a described `oxlint-disable-next-line` / `oxlint-disable-line typescript/no-unsafe-type-assertion` directive that covers the assertion.",
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
