// Vendored from src/rules/require-readable-spacing.ts@13909c9e07590f5a85d93c62712259fe14a883f7 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases. Upstream's statement-type names and selectors became statement tests,
// listed highest priority first. The class, interface, type, and binding tests
// match by node type, so `abstract`, `declare`, and decorated forms count too.
// Each group of policy entries became an option. The defaults match upstream,
// and opt-in `allow*` exceptions relax it.

import {
	CLASS_DECLARATION,
	DO_WHILE_STATEMENT,
	FOR_IN_STATEMENT,
	FOR_OF_STATEMENT,
	FOR_STATEMENT,
	FUNCTION_DECLARATION,
	IF_STATEMENT,
	isAssignmentExpression,
	isExportNamedDeclaration,
	isExpressionStatement,
	isIdentifier,
	isIfStatement,
	isImportDeclaration,
	isProgram,
	isReturnStatement,
	isThrowStatement,
	isTsDeclareFunction,
	isUpdateExpression,
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
import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Variable, Visitor } from "oxlint-plugin-utilities";

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

function isBinding(node: ESTree.Node): boolean {
	return isVariableDeclaration(getExportedDeclaration(node));
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

/**
 * Checks whether a statement reads a name that the statement before it
 * declares or assigns, as in `const ready = check();` then `if (ready)`, or
 * `index = next(index);` then `if (index === -1)`.
 *
 * @param previous - The statement before `next`.
 * @param next - The statement that may read the name.
 * @param sourceCode - The source code that holds both statements.
 * @returns `true` when `next` references a variable that `previous` writes.
 */
function readsNameAbove(previous: ESTree.Node, next: ESTree.Node, sourceCode: SourceCode): boolean {
	if (isVariableDeclaration(previous)) {
		for (const declarator of previous.declarations) {
			for (const variable of sourceCode.getDeclaredVariables(declarator)) {
				if (isReadWithin(variable, next.range)) return true;
			}
		}

		return false;
	}

	const target = getAssignedTarget(previous);
	return (
		isIdentifier(target) && isReadWithin(getVariableByName(sourceCode.getScope(target), target.name), next.range)
	);
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

function createPolicy(options: ReadableSpacingOptions): ReadonlyArray<PaddingRequirement> {
	const policy = new Array<PaddingRequirement>();
	for (const { option, requirement } of POLICY_ENTRIES) {
		if (option === undefined || options[option]) policy.push(requirement);
	}

	return policy;
}

const requireReadableSpacing = createRule("require-readable-spacing", "anti-slop", {
	create(context): Visitor {
		const [rawOptions] = context.options;
		return createPaddingLineVisitor(context, createPolicy({ ...DEFAULT_OPTIONS, ...rawOptions }));
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
				default: { ...DEFAULT_OPTIONS },
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
				},
				type: "object",
			},
		],
		type: "layout",
	},
});

export default requireReadableSpacing;
