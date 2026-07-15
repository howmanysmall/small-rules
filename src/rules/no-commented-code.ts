import { extname } from "node:path";
import { hasCodeLines } from "$oxc-utilities/recognizers/code-recognizer";
import { createJavaScriptDetectors } from "$oxc-utilities/recognizers/javascript-footprint";
import { isNumberRaw, isRecord, isStringRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";
import { parse } from "yuku-parser";

import type { Comment, ESTree, Fix, SourceCode, Visitor } from "oxlint-plugin-utilities";

const EXCLUDED_STATEMENTS = new Set(["BreakStatement", "ContinueStatement", "LabeledStatement"]);
function isExcludedStatement(
	statement: ESTree.Statement,
): statement is ESTree.BreakStatement | ESTree.ContinueStatement | ESTree.LabeledStatement {
	return EXCLUDED_STATEMENTS.has(statement.type);
}

interface CommentWithLocation extends Comment {
	readonly loc: NonNullable<Comment["loc"]>;
	readonly range: [number, number];
}

interface CommentGroup {
	readonly comments: ReadonlyArray<CommentWithLocation>;
	readonly value: string;
}

function createCommentGroup(comments: ReadonlyArray<CommentWithLocation>): CommentGroup {
	return {
		comments,
		value: comments.map(({ value }) => value).join("\n"),
	};
}

const detectors = createJavaScriptDetectors();

function areAdjacentLineComments(
	previous: CommentWithLocation,
	next: CommentWithLocation,
	sourceCode: SourceCode,
): boolean {
	const previousLine = previous.loc.start.line;
	const nextLine = next.loc.start.line;
	if (previousLine + 1 !== nextLine) return false;

	const tokenAfterPrevious = sourceCode.getTokenAfter(previous);
	if (!tokenAfterPrevious) return true;
	return tokenAfterPrevious.loc.start.line > nextLine;
}

function groupComments(comments: ReadonlyArray<Comment>, sourceCode: SourceCode): Array<CommentGroup> {
	const groups = new Array<CommentGroup>();
	let groupsSize = 0;
	let currentLineComments = new Array<CommentWithLocation>();
	let size = 0;

	for (const comment of comments) {
		if (comment.type === "Block") {
			if (size > 0) {
				groups[groupsSize++] = createCommentGroup(currentLineComments);
				currentLineComments = [];
				size = 0;
			}
			groups[groupsSize++] = createCommentGroup([comment]);
		} else if (size === 0) currentLineComments[size++] = comment;
		else {
			const lastComment = currentLineComments.at(-1);
			if (lastComment && areAdjacentLineComments(lastComment, comment, sourceCode)) {
				currentLineComments[size++] = comment;
			} else {
				groups[groupsSize++] = createCommentGroup(currentLineComments);
				currentLineComments = [comment];
				size = 1;
			}
		}
	}

	if (size > 0) groups[groupsSize] = createCommentGroup(currentLineComments);
	return groups;
}

const OPENING_BRACE = /\{/gu;
const CLOSING_BRACE = /\}/gu;
function injectMissingBraces(value: string): string {
	const openCount = (value.match(OPENING_BRACE) ?? []).length;
	const closeCount = (value.match(CLOSING_BRACE) ?? []).length;
	const diff = openCount - closeCount;

	if (diff > 0) return value + "}".repeat(diff);
	if (diff < 0) return "{".repeat(-diff) + value;
	return value;
}

function couldBeJsCode(input: string): boolean {
	return hasCodeLines(detectors, input.split("\n"));
}

function isReturnOrThrowExclusion(statement: ESTree.Statement): boolean {
	if (statement.type !== "ReturnStatement" && statement.type !== "ThrowStatement") return false;
	return statement.argument?.type === "Identifier";
}

function isUnaryPlusMinus(expression: ESTree.Expression): boolean {
	return expression.type === "UnaryExpression" && (expression.operator === "-" || expression.operator === "+");
}

function isExcludedLiteral(expression: { type: string; value?: unknown }): boolean {
	return expression.type === "Literal" && (isStringRaw(expression.value) || isNumberRaw(expression.value));
}

function isParsedStatement(value: unknown): value is ESTree.Statement {
	return isRecord(value) && isStringRaw(value.type);
}

function toParsedStatements(body: ReadonlyArray<unknown>): ReadonlyArray<ESTree.Statement> {
	const result = new Array<ESTree.Statement>();
	let size = 0;
	/* v8 ignore next -- @preserve parser program bodies contain parsed statement records. */
	for (const item of body) if (isParsedStatement(item)) result[size++] = item;
	return result;
}

function isExpressionExclusion(statement: ESTree.Statement, codeText: string): boolean {
	if (statement.type !== "ExpressionStatement") return false;

	const { expression } = statement;
	return (
		expression.type === "Identifier" ||
		expression.type === "SequenceExpression" ||
		isUnaryPlusMinus(expression) ||
		isExcludedLiteral(expression) ||
		!codeText.trimEnd().endsWith(";")
	);
}

function isExclusion(statements: ReadonlyArray<ESTree.Statement>, codeText: string): boolean {
	if (statements.length !== 1) return false;

	const statement = statements.at(0);
	/* v8 ignore next -- length check above guarantees a first statement for parser-produced arrays. @preserve */
	if (!statement) return false;

	return (
		isExcludedStatement(statement) ||
		isReturnOrThrowExclusion(statement) ||
		isExpressionExclusion(statement, codeText)
	);
}

const ALLOWED_PARSE_ERROR_PATTERNS = [/'return' statement is only valid inside a function/u] as const;
type Errors = ReadonlyArray<{ readonly message: string }>;
function hasOnlyAllowedErrors(errors: Errors): boolean {
	for (const error of errors) {
		let hasMatch = false;
		for (const pattern of ALLOWED_PARSE_ERROR_PATTERNS) {
			if (pattern.test(error.message)) {
				hasMatch = true;
				break;
			}
		}
		if (!hasMatch) return false;
	}
	return true;
}

interface Body {
	readonly body: ReadonlyArray<unknown>;
}

interface ParseResult {
	readonly diagnostics: Errors;
	readonly program: Body;
}

function isValidParseResult(result: ParseResult): boolean {
	const hasValidErrors = result.diagnostics.length === 0 || hasOnlyAllowedErrors(result.diagnostics);
	return hasValidErrors && result.program.body.length > 0;
}

function tryParse(value: string, filename: string): ParseResult | undefined {
	const extension = extname(filename);
	const LANG_BY_EXTENSION: Partial<Record<string, "js" | "jsx" | "tsx">> = { ".jsx": "jsx", ".tsx": "tsx" };
	const lang = LANG_BY_EXTENSION[extension] ?? "js";
	const result = parse(value, { lang, sourceType: "module" });

	if (isValidParseResult(result)) return result;

	/* v8 ignore next -- @preserve TSX/JSX files are parsed directly and do not need JSX fallback parsing. */
	if (extension !== ".tsx" && extension !== ".jsx") {
		const jsxResult = parse(value, { lang: "tsx", sourceType: "module" });
		if (isValidParseResult(jsxResult)) return jsxResult;
	}

	return undefined;
}

function containsCode(value: string, filename: string): boolean {
	if (!couldBeJsCode(value)) return false;

	const result = tryParse(value, filename);
	if (!result) return false;

	const statements = toParsedStatements(result.program.body);
	return !isExclusion(statements, value);
}

function countLines(value: string): number {
	let count = 1;
	for (const character of value) if (character === "\n") count += 1;
	return count;
}

const noCommentedCode = defineRule({
	create(context): Visitor {
		const { maxLines = 0 } = context.options[0] ?? {};

		return {
			"Program:exit"(): void {
				const allComments = context.sourceCode.getAllComments();
				const groups = groupComments(allComments, context.sourceCode);

				for (const group of groups) {
					const trimmedValue = group.value.trim();
					if (trimmedValue === "}") continue;

					const lineCount = countLines(group.value);
					if (lineCount <= maxLines) continue;

					const balanced = injectMissingBraces(trimmedValue);
					if (!containsCode(balanced, context.filename)) continue;

					const firstComment = group.comments.at(0);
					const lastComment = group.comments.at(-1);
					/* v8 ignore next -- comment groups are created only from non-empty comment arrays. @preserve */
					if (!(firstComment && lastComment)) continue;

					context.report({
						loc: {
							end: lastComment.loc.end,
							start: firstComment.loc.start,
						},
						messageId: "commentedCode",
						suggest: [
							{
								desc: "Remove this commented out code",
								fix(fixer): Fix {
									return fixer.removeRange([firstComment.range[0], lastComment.range[1]]);
								},
							},
						],
					});
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow commented-out code",
			recommended: false,
		},
		hasSuggestions: true,
		messages: {
			commentedCode:
				"Commented-out code creates confusion about intent and clutters the codebase. Version control preserves history, making dead code comments unnecessary. Delete the commented code entirely. If needed later, retrieve it from git history.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					maxLines: {
						default: 0,
						description:
							"Maximum number of lines of commented code allowed without reporting. Default 0 means any commented code triggers an error.",
						type: "number",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default noCommentedCode;
