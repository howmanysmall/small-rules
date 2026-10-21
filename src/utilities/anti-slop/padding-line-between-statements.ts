// oxlint-disable comment-length/limit-single-line-comments -- vendored header
// Vendored from src/vendor/eslint-stylistic/padding-line-between-statements.ts@13909c9e07590f5a85d93c62712259fe14a883f7 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// That file adapts packages/eslint-plugin/rules/padding-line-between-statements/padding-line-between-statements.ts@435c3ea0fd26a5fef9042c4b36b6e165fbbf8d08 by the ESLint Stylistic contributors.
// Source: https://github.com/eslint-stylistic/eslint-stylistic
// SPDX-License-Identifier: MIT
//
// Modifications: trimmed to the `always` and `any` padding types and to the
// block-like matcher, the only upstream behavior require-readable-spacing
// uses. Policy entries hold statement tests instead of statement-type names,
// and the first matching entry wins. Statement lists are read from their
// containers instead of tracking scopes per `:statement` visit. Tokens and
// comments come from getTokenBefore, getTokenAfter, and getCommentsBefore, and
// the owner of a closing brace is found by walking the statement's tail.
// oxlint-enable comment-length/limit-single-line-comments

import {
	DO_WHILE_STATEMENT,
	isBlockStatement,
	isCallbackFunction,
	isCallExpression,
	isChainExpression,
	isExpressionStatement,
	isLabeledStatement,
	isParenthesizedExpression,
	isSequenceExpression,
	isSwitchStatement,
	isUnaryExpression,
} from "@small-rules/oxlint-utilities";

import { appendVisitorChildren } from "$oxc-utilities/anti-slop/lexical-type-parameters";

import type {
	Comment,
	Context,
	ESTree,
	Fix,
	Fixer,
	Location,
	SourceCode,
	Token,
	Visitor,
} from "oxlint-plugin-utilities";

/** Whether a statement belongs to one side of a padding requirement. */
export type StatementTest = (node: ESTree.Node, sourceCode: SourceCode) => boolean;

/** One padding requirement between a previous and a next statement. */
export interface PaddingRequirement {
	/** `always` requires a blank line; `any` accepts either spacing. */
	readonly blankLine: "always" | "any";
	readonly next: StatementTest;
	readonly previous: StatementTest;
}

/** The text and comments between two adjacent statements. */
interface StatementGap {
	/**
	 * The last token of the previous statement, not counting a semicolon that
	 * opens the next line.
	 */
	readonly end: ESTree.Node | Token;
	/** The comments and tokens after `end`, in source order. */
	readonly items: ReadonlyArray<Comment | Token>;
}

type Positioned = Comment | ESTree.Node | Token;

export const PADDING_LINE_MESSAGES = {
	expectedBlankLine: "Expected blank line before this statement.",
} as const;

const LINE_TERMINATORS = new Set(["\n", "\r", "\u2028", "\u2029"]);

function isOnSameLine(left: Positioned, right: Positioned): boolean {
	return left.loc.end.line === right.loc.start.line;
}

/**
 * Skips optional chains, and the parentheses that parsers keeping them wrap
 * around expressions.
 *
 * @param node - The expression to unwrap.
 * @returns The innermost wrapped expression.
 */
function skipWrappers(node?: ESTree.Node): ESTree.Node | undefined {
	let current = node;
	while (current !== undefined && (isParenthesizedExpression(current) || isChainExpression(current))) {
		current = current.expression;
	}
	return current;
}

/**
 * Checks whether a statement calls a function expression immediately, such as
 * `(function () {})();` or `!function () {}();`.
 *
 * @param node - The statement to check.
 * @returns `true` for an immediately invoked function expression statement.
 */
function isIifeStatement(node: ESTree.Node): boolean {
	if (!isExpressionStatement(node)) return false;

	let expression = skipWrappers(node.expression);
	if (isUnaryExpression(expression)) expression = skipWrappers(expression.argument);
	if (!isCallExpression(expression)) return false;

	let callee = skipWrappers(expression.callee);
	while (callee !== undefined && isSequenceExpression(callee)) callee = skipWrappers(callee.expressions.at(-1));
	return isCallbackFunction(callee);
}

function getLastChild(node: ESTree.Node, visitorKeys: SourceCode["visitorKeys"]): ESTree.Node | undefined {
	const children = new Array<ESTree.Node>();
	appendVisitorChildren(node, visitorKeys, children);

	let lastChild: ESTree.Node | undefined;
	for (const child of children) if (lastChild === undefined || child.range[1] > lastChild.range[1]) lastChild = child;
	return lastChild;
}

/**
 * Finds the outermost block or switch statement along a statement's tail,
 * which is the only node whose closing brace can be the statement's last
 * non-semicolon token.
 *
 * @param node - The statement to search.
 * @param visitorKeys - Parser visitor keys identifying child properties.
 * @returns The block or switch statement, if the tail has one.
 */
function findTailBlock(
	node: ESTree.Node,
	visitorKeys: SourceCode["visitorKeys"],
): ESTree.BlockStatement | ESTree.SwitchStatement | undefined {
	let current: ESTree.Node | undefined = node;
	while (current !== undefined) {
		if (isBlockStatement(current) || isSwitchStatement(current)) return current;
		current = getLastChild(current, visitorKeys);
	}
	return undefined;
}

/**
 * Checks whether a statement ends with the closing brace of a block, as
 * `if (ok) {}`, `const run = () => {};`, and `switch (key) {}` do. Immediately
 * invoked function expressions and `do {} while (ok);` count as block-like
 * too.
 *
 * @param node - The statement to check.
 * @param sourceCode - The source code that holds the statement.
 * @returns `true` for a block-like statement.
 */
export function isBlockLikeStatement(node: ESTree.Node, sourceCode: SourceCode): boolean {
	if (node.type === DO_WHILE_STATEMENT && isBlockStatement(node.body)) return true;
	if (isIifeStatement(node)) return true;

	const block = findTailBlock(node, sourceCode.visitorKeys);
	if (block === undefined) return false;

	const tokenAfter = sourceCode.getTokenAfter(block);
	return (
		tokenAfter === null ||
		tokenAfter.range[0] >= node.range[1] ||
		(tokenAfter.value === ";" && tokenAfter.range[1] === node.range[1])
	);
}

function unwrapLabels(node: ESTree.Node): ESTree.Node {
	let statement = node;
	while (isLabeledStatement(statement)) statement = statement.body;
	return statement;
}

/**
 * Reads the gap between two adjacent statements. In semicolon-less code a
 * line can open with the semicolon that ends the previous statement, as in
 * `;[1, 2].forEach(run)`; the gap then starts at the token before it.
 *
 * @param previous - The earlier statement.
 * @param next - The statement right after it.
 * @param sourceCode - The source code that holds both statements.
 * @returns Where the previous statement ends and what sits between them.
 */
function getStatementGap(previous: ESTree.Node, next: ESTree.Node, sourceCode: SourceCode): StatementGap {
	const lastToken = sourceCode.getTokenBefore(next);
	if (lastToken?.value === ";") {
		const tokenBefore = sourceCode.getTokenBefore(lastToken);
		if (
			tokenBefore !== null &&
			tokenBefore.range[0] >= previous.range[0] &&
			!isOnSameLine(tokenBefore, lastToken) &&
			isOnSameLine(lastToken, next)
		) {
			return {
				end: tokenBefore,
				items: [...sourceCode.getCommentsBefore(lastToken), lastToken, ...sourceCode.getCommentsBefore(next)],
			};
		}
	}

	return { end: previous, items: sourceCode.getCommentsBefore(next) };
}

function hasPaddingLine({ end, items }: StatementGap, next: ESTree.Node): boolean {
	let { line } = end.loc.end;
	for (const item of items) {
		if (item.loc.start.line - line >= 2) return true;
		({ line } = item.loc.end);
	}
	return next.loc.start.line - line >= 2;
}

/**
 * Inserts a blank line after the previous statement and any comments that
 * trail it on the same line.
 *
 * @param fixer - The fixer to build the insertion with.
 * @param gap - The gap between the statements.
 * @param next - The statement that needs a blank line before it.
 * @returns The insertion.
 */
function insertPaddingLine(fixer: Fixer, { end, items }: StatementGap, next: ESTree.Node): Fix {
	let anchor: Positioned = end;
	let following: Positioned = next;
	for (const item of items) {
		if (!isOnSameLine(anchor, item)) {
			following = item;
			break;
		}
		anchor = item;
	}
	return fixer.insertTextAfter(anchor, isOnSameLine(anchor, following) ? "\n\n" : "\n");
}

/**
 * Narrows a report to the first line of a statement that spans several.
 *
 * @param node - The reported statement.
 * @param text - The source text.
 * @returns The location to report.
 */
function getReportLocation(node: ESTree.Node, text: string): Location {
	const { end, start } = node.loc;
	if (start.line === end.line) return node.loc;

	const lineStart = node.range[0] - start.column;
	let [lineEnd] = node.range;
	while (!LINE_TERMINATORS.has(text.charAt(lineEnd))) lineEnd += 1;
	return { end: { column: lineEnd - lineStart, line: start.line }, start };
}

/**
 * Creates a visitor that reports adjacent statements whose spacing breaks the
 * first matching requirement in `policy`, fixing each report by inserting a
 * blank line. Pairs that match no requirement are left alone.
 *
 * @param context - The rule context; its rule must declare
 *   {@linkcode PADDING_LINE_MESSAGES}.
 * @param policy - The padding requirements, highest priority first.
 * @returns Handlers for each node type that holds a list of statements.
 */
export function createPaddingLineVisitor(context: Context, policy: ReadonlyArray<PaddingRequirement>): Visitor {
	const { sourceCode } = context;

	function requiresPaddingLine(previous: ESTree.Node, next: ESTree.Node): boolean {
		const previousStatement = unwrapLabels(previous);
		const nextStatement = unwrapLabels(next);
		for (const requirement of policy) {
			if (requirement.previous(previousStatement, sourceCode) && requirement.next(nextStatement, sourceCode)) {
				return requirement.blankLine === "always";
			}
		}
		return false;
	}

	function verifyStatements(statements: ReadonlyArray<ESTree.Node>): void {
		let previous: ESTree.Node | undefined;
		for (const next of statements) {
			if (previous !== undefined && requiresPaddingLine(previous, next)) verifyPaddingLine(previous, next);
			previous = next;
		}
	}

	function verifyPaddingLine(previous: ESTree.Node, next: ESTree.Node): void {
		const gap = getStatementGap(previous, next, sourceCode);
		if (hasPaddingLine(gap, next)) return;

		context.report({
			fix: (fixer) => insertPaddingLine(fixer, gap, next),
			loc: getReportLocation(next, sourceCode.text),
			messageId: "expectedBlankLine",
			node: next,
		});
	}

	return {
		BlockStatement(node): void {
			verifyStatements(node.body);
		},
		Program(node): void {
			verifyStatements(node.body);
		},
		StaticBlock(node): void {
			verifyStatements(node.body);
		},
		SwitchCase(node): void {
			verifyStatements(node.consequent);
		},
		SwitchStatement(node): void {
			verifyStatements(node.cases);
		},
		TSModuleBlock(node): void {
			verifyStatements(node.body);
		},
	};
}
