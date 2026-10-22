import {
	CLASS_DECLARATION,
	DO_WHILE_STATEMENT,
	EMPTY_STATEMENT,
	FUNCTION_DECLARATION,
	isArrayExpression,
	isBlockStatement,
	isIfStatement,
	isObjectExpression,
	isReturnStatement,
	isTsAsExpression,
	isTsSatisfiesExpression,
	TS_DECLARE_FUNCTION,
	TS_ENUM_DECLARATION,
	TS_INTERFACE_DECLARATION,
	TS_MODULE_DECLARATION,
	TS_TYPE_ALIAS_DECLARATION,
	VARIABLE_DECLARATION,
} from "@small-rules/oxlint-utilities";

import { STATEMENT_KINDS_SCHEMA, toStatementTest } from "$oxc-utilities/anti-slop/statement-kinds";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Range, Visitor } from "oxlint-plugin-utilities";

type Loop =
	| ESTree.DoWhileStatement
	| ESTree.ForInStatement
	| ESTree.ForOfStatement
	| ESTree.ForStatement
	| ESTree.WhileStatement;

type HeaderToken = ")" | "do" | "else";

type MessageId = "complexBody" | "elseChain" | "loopBody" | "simpleBody";

// A declaration cannot stand as an unbraced body, so it never loses its braces.
const DECLARATION_TYPES = new Set<string>([
	CLASS_DECLARATION,
	DO_WHILE_STATEMENT,
	FUNCTION_DECLARATION,
	TS_DECLARE_FUNCTION,
	TS_ENUM_DECLARATION,
	TS_INTERFACE_DECLARATION,
	TS_MODULE_DECLARATION,
	TS_TYPE_ALIAS_DECLARATION,
	VARIABLE_DECLARATION,
]);
const ELSE_LENGTH = "else".length;

// `printWidth` and `tabWidth` match the formatter, so it never wraps a one-line
// form this rule asks for.
const DEFAULT_OPTIONS = {
	allowLiteralReturns: false,
	oneLineBodies: ["break", "continue", "return"],
	printWidth: 120,
	tabWidth: 4,
} as const;

function returnsLiteral(statement: ESTree.ReturnStatement): boolean {
	let value = statement.argument;
	while (isTsAsExpression(value) || isTsSatisfiesExpression(value)) value = value.expression;

	return isArrayExpression(value) || isObjectExpression(value);
}

const curly = createRule("curly", "general", {
	create(context): Visitor {
		const { sourceCode } = context;
		const { text } = sourceCode;
		const [rawOptions] = context.options;
		const { allowLiteralReturns, oneLineBodies, printWidth, tabWidth } = { ...DEFAULT_OPTIONS, ...rawOptions };
		const isOneLineKind = toStatementTest(oneLineBodies);

		/**
		 * Checks whether a statement may sit on one line after a lone `if`.
		 *
		 * @param statement - The body, or the one statement in its block.
		 * @returns `true` when `oneLineBodies` allows the statement.
		 */
		function isOneLineBody(statement: ESTree.Statement): boolean {
			if (DECLARATION_TYPES.has(statement.type) || !isOneLineKind(statement, sourceCode)) return false;
			return allowLiteralReturns || !isReturnStatement(statement) || !returnsLiteral(statement);
		}

		/**
		 * Finds where the token before a body ends. Only whitespace and the
		 * comments right before the body follow that token.
		 *
		 * @param body - The statement body.
		 * @param token - The token before it: `)`, `do`, or `else`.
		 * @returns The offset just past that token.
		 */
		function getHeaderEnd(body: ESTree.Node, token: HeaderToken): number {
			const [comment] = sourceCode.getCommentsBefore(body);
			const searchFrom = comment === undefined ? body.range[0] : comment.range[0];
			return text.lastIndexOf(token, searchFrom) + token.length;
		}

		function getLineStart(offset: number): number {
			return text.lastIndexOf("\n", offset - 1) + 1;
		}

		function isOneLine(start: number, end: number): boolean {
			const newline = text.indexOf("\n", start);
			return newline === -1 || newline >= end;
		}

		function getIndent(offset: number): string {
			const start = getLineStart(offset);
			let end = start;
			while (text[end] === "\t" || text[end] === " ") end += 1;

			return text.slice(start, end);
		}

		function getWidth(start: number, end: number): number {
			let width = 0;
			for (const character of text.slice(start, end)) width += character === "\t" ? tabWidth : 1;

			return width;
		}

		/**
		 * Reports a body, with a fix unless comments sit between it and its
		 * header, where the fix would drop them.
		 *
		 * @param body - The body to report.
		 * @param messageId - The message to report.
		 * @param range - The text the fix replaces.
		 * @param replacement - The text the fix writes.
		 */
		function report(body: ESTree.Statement, messageId: MessageId, range: Range, replacement: string): void {
			if (sourceCode.getCommentsBefore(body).length > 0) {
				context.report({ messageId, node: body });
				return;
			}

			context.report({ fix: (fixer) => fixer.replaceTextRange(range, replacement), messageId, node: body });
		}

		/**
		 * Reports a body that needs braces, with a fix that adds them.
		 *
		 * @param body - The unbraced body.
		 * @param messageId - The message to report.
		 * @param headerEnd - Where the token before the body ends.
		 * @param indentFrom - An offset on the line whose indentation the braces
		 *   take.
		 * @param nextStart - Where the `else` after the body starts. The fix joins
		 *   it to the closing brace when only whitespace separates them.
		 */
		function wrap(
			body: ESTree.Statement,
			messageId: MessageId,
			headerEnd: number,
			indentFrom: number,
			nextStart?: number,
		): void {
			if (body.type === EMPTY_STATEMENT) {
				report(body, messageId, [headerEnd, body.range[1]], " {}");
				return;
			}

			const joinsNext = nextStart !== undefined && text.slice(body.range[1], nextStart).trim().length === 0;
			const indent = getIndent(indentFrom);
			report(
				body,
				messageId,
				[headerEnd, joinsNext ? nextStart : body.range[1]],
				` {\n${indent}\t${sourceCode.getText(body)}\n${indent}}${joinsNext ? " " : ""}`,
			);
		}

		/**
		 * Measures `if (…) <body>` written on one line.
		 *
		 * @param node - The `if` statement.
		 * @param body - The statement that would follow the condition.
		 * @param headerEnd - Where the condition's `)` ends.
		 * @returns The width in columns, or `Infinity` when the condition or the
		 *   body spans lines.
		 */
		function getOneLineWidth(node: ESTree.IfStatement, body: ESTree.Statement, headerEnd: number): number {
			const [ifStart] = node.range;
			if (!isOneLine(ifStart, headerEnd) || body.loc.start.line !== body.loc.end.line) return Infinity;

			const [start, end] = body.range;
			return getWidth(getLineStart(ifStart), headerEnd) + 1 + getWidth(start, end);
		}

		function checkBracedLoneIf(node: ESTree.IfStatement, body: ESTree.BlockStatement, headerEnd: number): void {
			const [only] = body.body;
			if (only === undefined || body.body.length > 1 || !isOneLineBody(only)) return;
			if (sourceCode.getCommentsInside(body).length > 0) return;
			if (getOneLineWidth(node, only, headerEnd) > printWidth) return;
			// The `;` keeps a line that opens with `(` or `[` from joining the
			// statement.
			const semicolon = text[only.range[1] - 1] === ";" ? "" : ";";
			report(body, "simpleBody", [headerEnd, body.range[1]], ` ${sourceCode.getText(only)}${semicolon}`);
		}

		function checkLoneIf(node: ESTree.IfStatement): void {
			const body = node.consequent;
			const headerEnd = getHeaderEnd(body, ")");
			if (isBlockStatement(body)) {
				checkBracedLoneIf(node, body, headerEnd);
				return;
			}

			if (!isOneLineBody(body) || getOneLineWidth(node, body, headerEnd) > printWidth) {
				wrap(body, "complexBody", headerEnd, node.range[0]);
				return;
			}

			if (body.loc.start.line !== node.loc.start.line) {
				report(body, "simpleBody", [headerEnd, body.range[0]], " ");
			}
		}

		function checkBranch(
			body: ESTree.Statement,
			header: HeaderToken,
			indentFrom: number,
			nextStart?: number,
		): void {
			if (!isBlockStatement(body)) wrap(body, "elseChain", getHeaderEnd(body, header), indentFrom, nextStart);
		}

		function checkElseChain(node: ESTree.IfStatement, alternate: ESTree.Statement): void {
			const elseStart = getHeaderEnd(alternate, "else") - ELSE_LENGTH;
			checkBranch(node.consequent, ")", node.range[0], elseStart);

			// An `else if` is checked as its own `if`.
			if (!isIfStatement(alternate)) checkBranch(alternate, "else", elseStart);
		}

		function checkLoop(node: Loop): void {
			const { body } = node;
			if (isBlockStatement(body)) return;

			const header = node.type === DO_WHILE_STATEMENT ? "do" : ")";
			wrap(body, "loopBody", getHeaderEnd(body, header), node.range[0]);
		}

		return {
			DoWhileStatement: checkLoop,
			ForInStatement: checkLoop,
			ForOfStatement: checkLoop,
			ForStatement: checkLoop,
			IfStatement(node): void {
				const { alternate, parent } = node;
				if (alternate !== null) {
					checkElseChain(node, alternate);
					return;
				}

				if (isIfStatement(parent) && parent.alternate === node) {
					checkBranch(node.consequent, ")", node.range[0]);
				} else checkLoneIf(node);
			},
			WhileStatement: checkLoop,
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Require one brace style for each `if`, `else`, and loop body: one line for a lone `if` with a short body that fits, braces for every other body.",
		},
		fixable: "code",
		messages: {
			complexBody:
				"Wrap this `if` body in braces. Only a lone `if` whose one statement fits on one line and is a kind `oneLineBodies` allows omits them. By default those are `return`, `break`, and `continue`, and an object or array `return` keeps its braces.",
			elseChain: "Wrap this branch in braces. Every branch of an `if` with an `else` needs them.",
			loopBody: "Wrap the loop body in braces.",
			simpleBody:
				"Put this `if` and its body on one line, without braces. A lone `if` whose one statement fits on one line and is a kind `oneLineBodies` allows has no braces.",
		},
		schema: [
			{
				additionalProperties: false,
				default: DEFAULT_OPTIONS,
				properties: {
					allowLiteralReturns: {
						default: false,
						description: "Let a `return` of an object or array literal sit on one line after a lone `if`",
						type: "boolean",
					},
					oneLineBodies: {
						...STATEMENT_KINDS_SCHEMA,
						default: DEFAULT_OPTIONS.oneLineBodies,
						description:
							"The statement kind or kinds that sit on one line, without braces, after a lone `if`. Declarations always keep their braces",
					},
					printWidth: {
						default: 120,
						description: "The longest line, in columns, that a one-line `if` may make; match the formatter",
						minimum: 1,
						type: "integer",
					},
					tabWidth: {
						default: 4,
						description: "The columns a tab counts as when measuring a line; match the formatter",
						minimum: 1,
						type: "integer",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default curly;
