// Vendored from src/rules/require-readable-spacing.ts@13909c9e07590f5a85d93c62712259fe14a883f7 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases. Upstream's statement-type names and selectors became statement tests,
// listed highest priority first. The class, interface, type, and binding tests
// match by node type, so `abstract`, `declare`, and decorated forms count too.
// Each group of policy entries became an option. The defaults match upstream,
// opt-in `allow*` exceptions relax it, and `overrides` entries built from named
// statement kinds take priority over everything built in. Declarations match
// through `export` and `export default`.

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
	isAssignmentExpression,
	isExportDefaultDeclaration,
	isExportNamedDeclaration,
	isExpressionStatement,
	isIdentifier,
	isIfStatement,
	isImportDeclaration,
	isProgram,
	isReturnStatement,
	isSwitchStatement,
	isThrowStatement,
	isTryStatement,
	isTsDeclareFunction,
	isUpdateExpression,
	isVariableDeclaration,
	RETURN_STATEMENT,
	SWITCH_STATEMENT,
	TRY_STATEMENT,
	TS_DECLARE_FUNCTION,
	TS_ENUM_DECLARATION,
	TS_EXPORT_ASSIGNMENT,
	TS_INTERFACE_DECLARATION,
	TS_TYPE_ALIAS_DECLARATION,
	WHILE_STATEMENT,
} from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";

import {
	createPaddingLineVisitor,
	isBlockLikeStatement,
	PADDING_LINE_MESSAGES,
} from "$oxc-utilities/anti-slop/padding-line-between-statements";
import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Variable, Visitor } from "oxlint-plugin-utilities";

import type { PaddingRequirement, StatementTest } from "$oxc-utilities/anti-slop/padding-line-between-statements";

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
const OVERLOAD_TYPES = new Set<string>([FUNCTION_DECLARATION, TS_DECLARE_FUNCTION]);

function isSingleLine(node: ESTree.Node): boolean {
	return node.loc.start.line === node.loc.end.line;
}

function getExportedDeclaration(node: ESTree.Node): ESTree.Node | null {
	return isExportNamedDeclaration(node) || isExportDefaultDeclaration(node) ? node.declaration : node;
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

function isBinding(node: ESTree.Node): boolean {
	return isVariableDeclaration(getExportedDeclaration(node));
}

function isMultilineBinding(node: ESTree.Node): boolean {
	return isBinding(node) && !isSingleLine(node);
}

function isUndocumentedBinding(node: ESTree.Node, sourceCode: SourceCode): boolean {
	return isBinding(node) && !hasLeadingComment(node, sourceCode);
}

function isUndocumentedSingleLineBinding(node: ESTree.Node, sourceCode: SourceCode): boolean {
	return isSingleLineBinding(node) && !hasLeadingComment(node, sourceCode);
}

function getAssignedTarget(node: ESTree.Node): ESTree.Node | undefined {
	if (!isExpressionStatement(node)) return undefined;

	const { expression } = node;
	if (isAssignmentExpression(expression)) return expression.left;
	if (isUpdateExpression(expression)) return expression.argument;
	return undefined;
}

function isReadWithin(variable: undefined | Variable, [start, end]: ESTree.Node["range"]): boolean {
	if (variable === undefined) return false;

	for (const { identifier } of variable.references) {
		const [position] = identifier.range;
		if (position >= start && position < end) return true;
	}

	return false;
}

function readsAnyWithin(variables: ReadonlyArray<Variable>, range: ESTree.Node["range"]): boolean {
	for (const variable of variables) if (isReadWithin(variable, range)) return true;

	return false;
}

/**
 * Checks whether a statement reads a name that the statement before it
 * declares or assigns, as in `const ready = check();` then `if (ready)`,
 * `index = next(index);` then `if (index === -1)`, or `enum Kind {}` then
 * `const kinds = Object.values(Kind);`.
 *
 * @param previous - The statement before `next`.
 * @param next - The statement that may read the name.
 * @param sourceCode - The source code that holds both statements.
 * @returns `true` when `next` references a variable that `previous` writes.
 */
function readsNameAbove(previous: ESTree.Node, next: ESTree.Node, sourceCode: SourceCode): boolean {
	const target = getAssignedTarget(previous);
	if (isIdentifier(target)) {
		return isReadWithin(getVariableByName(sourceCode.getScope(target), target.name), next.range);
	}

	const declaration = getExportedDeclaration(previous);
	if (declaration === null) return false;

	if (!isVariableDeclaration(declaration)) {
		return readsAnyWithin(sourceCode.getDeclaredVariables(declaration), next.range);
	}

	for (const declarator of declaration.declarations) {
		if (readsAnyWithin(sourceCode.getDeclaredVariables(declarator), next.range)) return true;
	}

	return false;
}

function isOverloadSignature(node: ESTree.Node): boolean {
	const declaration = getExportedDeclaration(node);
	return declaration !== null && isTsDeclareFunction(declaration);
}

function isOverloadOrImplementation(node: ESTree.Node): boolean {
	const declaration = getExportedDeclaration(node);
	return declaration !== null && OVERLOAD_TYPES.has(declaration.type);
}

function isSingleLineIf(node: ESTree.Node): boolean {
	return isIfStatement(node) && isSingleLine(node);
}

function isSingleLineGuardContinuation(node: ESTree.Node): boolean {
	return (isIfStatement(node) || isReturnStatement(node) || isThrowStatement(node)) && isSingleLine(node);
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

const STATEMENT_KIND_NAMES = [
	"*",
	"binding",
	"block-like",
	"class",
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

type StatementKind = (typeof STATEMENT_KIND_NAMES)[number];

type StatementKinds = ReadonlyArray<StatementKind> | StatementKind;

const NO_OVERRIDES: ReadonlyArray<PaddingOverride> = [];

// Declarations match through `export` and `export default`.
const STATEMENT_KINDS: Readonly<Record<StatementKind, StatementTest>> = {
	"*": isAnyStatement,
	binding: isBinding,
	"block-like": isBlockLikeStatement,
	class: matchesExported(new Set([CLASS_DECLARATION])),
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
	if (matches === undefined) throw new RangeError(`Unknown statement kind: ${kind}`);

	return matches;
}

/** A padding entry written in the rule options. */
interface PaddingOverride {
	readonly blankLine: "always" | "any";
	readonly next: StatementKinds;
	readonly previous: StatementKinds;
	readonly usesPrevious?: boolean;
}

function toStatementTest(kinds: StatementKinds): StatementTest {
	if (Predicate.isString(kinds)) return getStatementTest(kinds);

	const tests = kinds.map(getStatementTest);
	return (node, sourceCode) => {
		for (const matches of tests) if (matches(node, sourceCode)) return true;

		return false;
	};
}

function toRequirement({ blankLine, next, previous, usesPrevious }: PaddingOverride): PaddingRequirement {
	const requirement: PaddingRequirement = {
		blankLine,
		next: toStatementTest(next),
		previous: toStatementTest(previous),
	};

	return usesPrevious === true ? { ...requirement, pair: readsNameAbove } : requirement;
}

interface ReadableSpacingOptions {
	readonly afterBlocks: boolean;
	readonly afterImports: boolean;
	readonly allowAttachedUses: boolean;
	readonly allowGuardClauseRuns: boolean;
	readonly allowMultilineBindingRuns: boolean;
	readonly aroundDeclarations: boolean;
	readonly aroundMultilineBindings: boolean;
	readonly beforeControlFlow: boolean;
	readonly betweenTopLevelStatements: boolean;
}

/** One policy entry, and the option that turns it on when it has one. */
interface PolicyEntry {
	readonly option?: keyof ReadableSpacingOptions;
	readonly requirement: PaddingRequirement;
}

const DEFAULT_OPTIONS: ReadableSpacingOptions = {
	afterBlocks: true,
	afterImports: true,
	allowAttachedUses: false,
	allowGuardClauseRuns: false,
	allowMultilineBindingRuns: false,
	aroundDeclarations: true,
	aroundMultilineBindings: true,
	beforeControlFlow: true,
	betweenTopLevelStatements: true,
};

// Highest priority first; the first entry that matches a pair decides it.
const POLICY_ENTRIES: ReadonlyArray<PolicyEntry> = [
	// Overload signatures stay attached to each other and to the implementation.
	{ requirement: { blankLine: "any", next: isOverloadOrImplementation, previous: isOverloadSignature } },
	// Consecutive single-line bindings form one group at any scope, including
	// module scope. A binding with its own leading comment starts a new group.
	{ requirement: { blankLine: "any", next: isUndocumentedSingleLineBinding, previous: isSingleLineBinding } },
	{
		option: "allowMultilineBindingRuns",
		requirement: { blankLine: "any", next: isUndocumentedBinding, previous: isBinding },
	},
	{ requirement: { blankLine: "any", next: isImportDeclaration, previous: isImportDeclaration } },
	{
		option: "afterImports",
		requirement: { blankLine: "always", next: isAnyStatement, previous: isImportDeclaration },
	},
	{
		option: "betweenTopLevelStatements",
		requirement: { blankLine: "always", next: isTopLevelStatement, previous: isAnyStatement },
	},
	{
		option: "betweenTopLevelStatements",
		requirement: { blankLine: "always", next: isAnyStatement, previous: isTopLevelStatement },
	},
	{
		option: "aroundDeclarations",
		requirement: { blankLine: "always", next: isDeclarationStatement, previous: isAnyStatement },
	},
	{
		option: "aroundDeclarations",
		requirement: { blankLine: "always", next: isAnyStatement, previous: isDeclarationStatement },
	},
	{
		option: "allowAttachedUses",
		requirement: { blankLine: "any", next: isAnyStatement, pair: readsNameAbove, previous: isSingleLine },
	},
	{
		option: "allowGuardClauseRuns",
		requirement: { blankLine: "any", next: isSingleLineGuardContinuation, previous: isSingleLineIf },
	},
	{
		option: "aroundMultilineBindings",
		requirement: { blankLine: "always", next: isMultilineBinding, previous: isAnyStatement },
	},
	{
		option: "aroundMultilineBindings",
		requirement: { blankLine: "always", next: isAnyStatement, previous: isMultilineBinding },
	},
	{
		option: "beforeControlFlow",
		requirement: { blankLine: "always", next: isControlFlowStatement, previous: isAnyStatement },
	},
	// Last because it walks the statement's tail.
	{
		option: "afterBlocks",
		requirement: { blankLine: "always", next: isAnyStatement, previous: isBlockLikeStatement },
	},
];

function createPolicy(
	options: ReadableSpacingOptions,
	overrides: ReadonlyArray<PaddingOverride>,
): ReadonlyArray<PaddingRequirement> {
	const policy = overrides.map(toRequirement);
	for (const { option, requirement } of POLICY_ENTRIES) {
		if (option === undefined || options[option]) policy.push(requirement);
	}

	return policy;
}

const STATEMENT_KINDS_SCHEMA = {
	anyOf: [
		{ enum: STATEMENT_KIND_NAMES, type: "string" },
		{ items: { enum: STATEMENT_KIND_NAMES, type: "string" }, minItems: 1, type: "array" },
	],
} as const;

const requireReadableSpacing = createRule("require-readable-spacing", "anti-slop", {
	create(context): Visitor {
		const [rawOptions] = context.options;
		return createPaddingLineVisitor(
			context,
			createPolicy({ ...DEFAULT_OPTIONS, ...rawOptions }, rawOptions?.overrides ?? NO_OVERRIDES),
		);
	},
	meta: {
		docs: {
			description: "Require readable spacing between declarations and logical statement groups.",
		},
		fixable: "whitespace",
		messages: PADDING_LINE_MESSAGES,
		schema: [
			{
				additionalProperties: false,
				default: { ...DEFAULT_OPTIONS, overrides: [] },
				properties: {
					afterBlocks: {
						default: true,
						description: "Require a blank line after a statement that ends in a block",
						type: "boolean",
					},
					afterImports: {
						default: true,
						description: "Require a blank line after the import group",
						type: "boolean",
					},
					allowAttachedUses: {
						default: false,
						description:
							"Let a statement stay attached to the one-line statement above it when it reads a name that statement declares or assigns",
						type: "boolean",
					},
					allowGuardClauseRuns: {
						default: false,
						description:
							"Let one-line `if` statements, and a one-line `return` or `throw` after one, stay grouped",
						type: "boolean",
					},
					allowMultilineBindingRuns: {
						default: false,
						description: "Let consecutive bindings stay grouped when one of them spans lines",
						type: "boolean",
					},
					aroundDeclarations: {
						default: true,
						description: "Require blank lines around functions, classes, interfaces, and types",
						type: "boolean",
					},
					aroundMultilineBindings: {
						default: true,
						description: "Require blank lines around bindings that span lines",
						type: "boolean",
					},
					beforeControlFlow: {
						default: true,
						description: "Require a blank line before control flow statements",
						type: "boolean",
					},
					betweenTopLevelStatements: {
						default: true,
						description: "Require blank lines between top-level statements",
						type: "boolean",
					},
					overrides: {
						default: [],
						description:
							"Padding entries checked before the built-in ones, highest priority first. The first entry that matches a pair of statements decides it",
						items: {
							additionalProperties: false,
							properties: {
								blankLine: {
									description:
										"`always` requires a blank line between the statements; `any` accepts either spacing",
									enum: ["always", "any"],
									type: "string",
								},
								next: {
									...STATEMENT_KINDS_SCHEMA,
									description: "The kind or kinds of the second statement",
								},
								previous: {
									...STATEMENT_KINDS_SCHEMA,
									description: "The kind or kinds of the first statement",
								},
								usesPrevious: {
									default: false,
									description:
										"Match only when the second statement reads a name that the first one declares or assigns",
									type: "boolean",
								},
							},
							required: ["blankLine", "next", "previous"],
							type: "object",
						},
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "layout",
	},
});

export default requireReadableSpacing;
