// Vendored from src/rules/require-readable-spacing.ts@13909c9e07590f5a85d93c62712259fe14a883f7 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: split out of require-readable-spacing so other rules can name
// statements the same way. Upstream's statement-type names and selectors
// became statement tests, and each test has a kind name that rule options
// accept. The class, interface, type, and binding tests match by node type, so
// `abstract`, `declare`, and decorated forms count too. Declarations match
// through `export` and `export default`. `break` and `continue` are local.

import {
	CLASS_DECLARATION,
	DO_WHILE_STATEMENT,
	EXPORT_ALL_DECLARATION,
	EXPORT_DEFAULT_DECLARATION,
	EXPORT_NAMED_DECLARATION,
	FOR_IN_STATEMENT,
	FOR_OF_STATEMENT,
	FOR_STATEMENT,
	FUNCTION_DECLARATION,
	IF_STATEMENT,
	isBreakStatement,
	isContinueStatement,
	isExportDefaultDeclaration,
	isExportNamedDeclaration,
	isExpressionStatement,
	isIfStatement,
	isImportDeclaration,
	isProgram,
	isReturnStatement,
	isSwitchStatement,
	isThrowStatement,
	isTryStatement,
	isTsDeclareFunction,
	isVariableDeclaration,
	RETURN_STATEMENT,
	SWITCH_STATEMENT,
	TRY_STATEMENT,
	TS_ENUM_DECLARATION,
	TS_EXPORT_ASSIGNMENT,
	TS_INTERFACE_DECLARATION,
	TS_TYPE_ALIAS_DECLARATION,
	WHILE_STATEMENT,
} from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";

import { isBlockLikeStatement } from "$oxc-utilities/anti-slop/padding-line-between-statements";

import type { ESTree } from "oxlint-plugin-utilities";

import type { StatementTest } from "$oxc-utilities/anti-slop/padding-line-between-statements";

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
const LOOP_TYPES = new Set<string>([
	DO_WHILE_STATEMENT,
	FOR_IN_STATEMENT,
	FOR_OF_STATEMENT,
	FOR_STATEMENT,
	WHILE_STATEMENT,
]);

export function isSingleLine(node: ESTree.Node): boolean {
	return node.loc.start.line === node.loc.end.line;
}

export function getExportedDeclaration(node: ESTree.Node): ESTree.Node | null {
	return isExportNamedDeclaration(node) || isExportDefaultDeclaration(node) ? node.declaration : node;
}

export function isAnyStatement(): boolean {
	return true;
}

export function isTopLevelStatement(node: ESTree.Node): boolean {
	return isProgram(node.parent) && !isImportDeclaration(node);
}

export function isDeclarationStatement(node: ESTree.Node): boolean {
	return DECLARATION_TYPES.has(node.type);
}

export function isControlFlowStatement(node: ESTree.Node): boolean {
	return CONTROL_FLOW_TYPES.has(node.type);
}

/**
 * Checks for a `const`, `let`, `var`, or `using` declaration, optionally
 * exported, written on one line.
 *
 * @param node - The statement to check.
 * @returns `true` for a single-line binding.
 */
export function isSingleLineBinding(node: ESTree.Node): boolean {
	return isVariableDeclaration(getExportedDeclaration(node)) && isSingleLine(node);
}

export function isBinding(node: ESTree.Node): boolean {
	return isVariableDeclaration(getExportedDeclaration(node));
}

export function isMultilineBinding(node: ESTree.Node): boolean {
	return isBinding(node) && !isSingleLine(node);
}

export function isOverloadSignature(node: ESTree.Node): boolean {
	const declaration = getExportedDeclaration(node);
	return declaration !== null && isTsDeclareFunction(declaration);
}

export function isSingleLineIf(node: ESTree.Node): boolean {
	return isIfStatement(node) && isSingleLine(node);
}

function isMultiline(node: ESTree.Node): boolean {
	return !isSingleLine(node);
}

function matchesType(types: ReadonlySet<string>): StatementTest {
	return (node) => types.has(node.type);
}

function matchesExported(types: ReadonlySet<string>): StatementTest {
	return (node) => {
		const declaration = getExportedDeclaration(node);
		return declaration !== null && types.has(declaration.type);
	};
}

export const STATEMENT_KIND_NAMES = [
	"*",
	"binding",
	"block-like",
	"break",
	"class",
	"continue",
	"control-flow",
	"declaration",
	"enum",
	"export",
	"expression",
	"function",
	"if",
	"import",
	"interface",
	"loop",
	"multiline",
	"multiline-binding",
	"overload",
	"return",
	"single-line",
	"single-line-binding",
	"single-line-if",
	"switch",
	"throw",
	"top-level",
	"try",
	"type",
] as const;

export type StatementKind = (typeof STATEMENT_KIND_NAMES)[number];

/** One statement kind, or a list of them, as rule options write it. */
export type StatementKinds = ReadonlyArray<StatementKind> | StatementKind;

const STATEMENT_KINDS: Readonly<Record<StatementKind, StatementTest>> = {
	"*": isAnyStatement,
	binding: isBinding,
	"block-like": isBlockLikeStatement,
	break: isBreakStatement,
	class: matchesExported(new Set([CLASS_DECLARATION])),
	continue: isContinueStatement,
	"control-flow": isControlFlowStatement,
	declaration: matchesExported(DECLARATION_TYPES),
	enum: matchesExported(new Set([TS_ENUM_DECLARATION])),
	export: matchesType(
		new Set([EXPORT_ALL_DECLARATION, EXPORT_DEFAULT_DECLARATION, EXPORT_NAMED_DECLARATION, TS_EXPORT_ASSIGNMENT]),
	),
	expression: isExpressionStatement,
	function: matchesExported(new Set([FUNCTION_DECLARATION])),
	if: isIfStatement,
	import: isImportDeclaration,
	interface: matchesExported(new Set([TS_INTERFACE_DECLARATION])),
	loop: matchesType(LOOP_TYPES),
	multiline: isMultiline,
	"multiline-binding": isMultilineBinding,
	overload: isOverloadSignature,
	return: isReturnStatement,
	"single-line": isSingleLine,
	"single-line-binding": isSingleLineBinding,
	"single-line-if": isSingleLineIf,
	switch: isSwitchStatement,
	throw: isThrowStatement,
	"top-level": isTopLevelStatement,
	try: isTryStatement,
	type: matchesExported(new Set([TS_TYPE_ALIAS_DECLARATION])),
};

const STATEMENT_KIND_TESTS = new Map<string, StatementTest>(Object.entries(STATEMENT_KINDS));

function getStatementTest(kind: StatementKind): StatementTest {
	const matches = STATEMENT_KIND_TESTS.get(kind);
	/* v8 ignore next -- @preserve the schema only allows known statement kinds. */
	if (matches === undefined) {
		throw new RangeError(`Unknown statement kind: ${kind}`);
	}

	return matches;
}

/**
 * Builds the test for one statement kind, or for any of a list of them.
 *
 * @param kinds - The kind or kinds, as the rule options name them.
 * @returns A test that matches a statement of any of the kinds.
 */
export function toStatementTest(kinds: StatementKinds): StatementTest {
	if (Predicate.isString(kinds)) return getStatementTest(kinds);

	const tests = kinds.map(getStatementTest);
	return (node, sourceCode) => {
		for (const matches of tests) {
			if (matches(node, sourceCode)) return true;
		}

		return false;
	};
}

/** The schema for an option that takes one statement kind or a list of them. */
export const STATEMENT_KINDS_SCHEMA = {
	anyOf: [
		{ enum: STATEMENT_KIND_NAMES, type: "string" },
		{ items: { enum: STATEMENT_KIND_NAMES, type: "string" }, minItems: 1, type: "array" },
	],
} as const;
