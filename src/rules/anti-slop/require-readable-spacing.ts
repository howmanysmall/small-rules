// Vendored from src/rules/require-readable-spacing.ts@13909c9e07590f5a85d93c62712259fe14a883f7 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases. Upstream's statement-type names and selectors became statement tests,
// listed highest priority first. The class, interface, type, and binding tests
// match by node type, so `abstract`, `declare`, and decorated forms count too.

import {
	CLASS_DECLARATION,
	DO_WHILE_STATEMENT,
	FOR_IN_STATEMENT,
	FOR_OF_STATEMENT,
	FOR_STATEMENT,
	FUNCTION_DECLARATION,
	IF_STATEMENT,
	isExportNamedDeclaration,
	isImportDeclaration,
	isProgram,
	isTsDeclareFunction,
	isVariableDeclaration,
	RETURN_STATEMENT,
	SWITCH_STATEMENT,
	TRY_STATEMENT,
	TS_DECLARE_FUNCTION,
	TS_INTERFACE_DECLARATION,
	TS_TYPE_ALIAS_DECLARATION,
	WHILE_STATEMENT,
} from "@small-rules/oxlint-utilities";

import {
	createPaddingLineVisitor,
	isBlockLikeStatement,
	PADDING_LINE_MESSAGES,
} from "$oxc-utilities/anti-slop/padding-line-between-statements";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { PaddingRequirement } from "$oxc-utilities/anti-slop/padding-line-between-statements";

const CONTROL_FLOW_TYPES = new Set<string>([
	DO_WHILE_STATEMENT,
	FOR_IN_STATEMENT,
	FOR_OF_STATEMENT,
	FOR_STATEMENT,
	IF_STATEMENT,
	RETURN_STATEMENT,
	SWITCH_STATEMENT,
	TRY_STATEMENT,
	WHILE_STATEMENT,
]);
const DECLARATION_TYPES = new Set<string>([
	CLASS_DECLARATION,
	FUNCTION_DECLARATION,
	TS_INTERFACE_DECLARATION,
	TS_TYPE_ALIAS_DECLARATION,
]);
const OVERLOAD_TYPES = new Set<string>([FUNCTION_DECLARATION, TS_DECLARE_FUNCTION]);

function isSingleLine(node: ESTree.Node): boolean {
	return node.loc.start.line === node.loc.end.line;
}

function getExportedDeclaration(node: ESTree.Node): ESTree.Node | null {
	return isExportNamedDeclaration(node) ? node.declaration : node;
}

function isAnyStatement(): boolean {
	return true;
}

function isTopLevelStatement(node: ESTree.Node): boolean {
	return isProgram(node.parent) && !isImportDeclaration(node);
}

function isDeclarationStatement(node: ESTree.Node): boolean {
	return DECLARATION_TYPES.has(node.type);
}

function isControlFlowStatement(node: ESTree.Node): boolean {
	return CONTROL_FLOW_TYPES.has(node.type);
}

function isMultilineBinding(node: ESTree.Node): boolean {
	return isVariableDeclaration(node) && !isSingleLine(node);
}

/**
 * Checks for a `const`, `let`, `var`, or `using` declaration, optionally
 * exported, written on one line.
 *
 * @param node - The statement to check.
 * @returns `true` for a single-line binding.
 */
function isSingleLineBinding(node: ESTree.Node): boolean {
	return isVariableDeclaration(getExportedDeclaration(node)) && isSingleLine(node);
}

/**
 * Checks whether a comment sits above a statement. A comment that trails the
 * previous line belongs to that line instead.
 *
 * @param node - The statement to check.
 * @param sourceCode - The source code that holds the statement.
 * @returns `true` when the statement has its own leading comment.
 */
function hasLeadingComment(node: ESTree.Node, sourceCode: SourceCode): boolean {
	const previousLine = sourceCode.getTokenBefore(node)?.loc.end.line;
	for (const comment of sourceCode.getCommentsBefore(node)) if (comment.loc.start.line !== previousLine) return true;
	return false;
}

function isUndocumentedSingleLineBinding(node: ESTree.Node, sourceCode: SourceCode): boolean {
	return isSingleLineBinding(node) && !hasLeadingComment(node, sourceCode);
}

function isOverloadSignature(node: ESTree.Node): boolean {
	const declaration = getExportedDeclaration(node);
	return declaration !== null && isTsDeclareFunction(declaration);
}

function isOverloadOrImplementation(node: ESTree.Node): boolean {
	const declaration = getExportedDeclaration(node);
	return declaration !== null && OVERLOAD_TYPES.has(declaration.type);
}

const READABLE_SPACING_POLICY: ReadonlyArray<PaddingRequirement> = [
	// Overload signatures stay attached to each other and to the implementation.
	{ blankLine: "any", next: isOverloadOrImplementation, previous: isOverloadSignature },
	// Consecutive single-line bindings form one group at any scope, including
	// module scope. A binding with its own leading comment starts a new group.
	{ blankLine: "any", next: isUndocumentedSingleLineBinding, previous: isSingleLineBinding },
	{ blankLine: "any", next: isImportDeclaration, previous: isImportDeclaration },
	{ blankLine: "always", next: isAnyStatement, previous: isImportDeclaration },
	{ blankLine: "always", next: isTopLevelStatement, previous: isAnyStatement },
	{ blankLine: "always", next: isAnyStatement, previous: isTopLevelStatement },
	{ blankLine: "always", next: isDeclarationStatement, previous: isAnyStatement },
	{ blankLine: "always", next: isAnyStatement, previous: isDeclarationStatement },
	{ blankLine: "always", next: isMultilineBinding, previous: isAnyStatement },
	{ blankLine: "always", next: isAnyStatement, previous: isMultilineBinding },
	{ blankLine: "always", next: isControlFlowStatement, previous: isAnyStatement },
	// Last because it walks the statement's tail.
	{ blankLine: "always", next: isAnyStatement, previous: isBlockLikeStatement },
];

const requireReadableSpacing = createRule("require-readable-spacing", "anti-slop", {
	create(context): Visitor {
		return createPaddingLineVisitor(context, READABLE_SPACING_POLICY);
	},
	meta: {
		docs: {
			description: "Require readable spacing between declarations and logical statement groups.",
		},
		fixable: "whitespace",
		messages: PADDING_LINE_MESSAGES,
		schema: [] as const,
		type: "layout",
	},
});

export default requireReadableSpacing;
