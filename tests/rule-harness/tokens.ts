import { createRange, locationForRange } from "./locations";

import type { LocationIndex } from "./locations";
import type { HarnessComment, HarnessToken } from "./types";

const IDENTIFIER_START = /[$A-Z_a-z]/u;
const IDENTIFIER_PART = /[$\w]/u;
const DECIMAL_DIGIT = /\d/u;
const WHITESPACE = /\s/u;
const NUMBER_PART = /[\dA-FNOUX_.]/iu;
const MULTI_CHARACTER_PUNCTUATORS = [
	">>>=",
	"===",
	"!==",
	">>>",
	"<<=",
	">>=",
	"**=",
	"&&=",
	"||=",
	"??=",
	"=>",
	"==",
	"!=",
	"<=",
	">=",
	"++",
	"--",
	"<<",
	">>",
	"**",
	"&&",
	"||",
	"??",
	"+=",
	"-=",
	"*=",
	"/=",
	"%=",
	"&=",
	"|=",
	"^=",
	"?.",
	"...",
];

export function createComments(
	rawComments: ReadonlyArray<unknown>,
	locationIndex: LocationIndex,
): Array<HarnessComment> {
	const comments = new Array<HarnessComment>();
	let size = 0;
	for (const comment of rawComments) {
		if (!isRawComment(comment)) continue;
		const range = createRange(comment.start, comment.end);
		comments[size++] = {
			loc: locationForRange(locationIndex, range),
			range,
			type: comment.type,
			value: comment.value,
		};
	}
	return comments;
}

export function tokenize(
	text: string,
	comments: ReadonlyArray<HarnessComment>,
	locationIndex: LocationIndex,
): Array<HarnessToken> {
	const tokens = new Array<HarnessToken>();
	let size = 0;
	let index = 0;

	while (index < text.length) {
		if (shouldSkip(text[index])) {
			index += 1;
			continue;
		}

		const comment = findCommentAt(comments, index);
		if (comment !== undefined) {
			const [, end] = comment.range;
			index = end;
			continue;
		}

		const tokenEnd = readTokenEnd(text, index);
		const range = createRange(index, tokenEnd);
		tokens[size++] = {
			loc: locationForRange(locationIndex, range),
			range,
			type: classifyToken(text.slice(index, tokenEnd)),
			value: text.slice(index, tokenEnd),
		};
		index = tokenEnd;
	}

	return tokens;
}

interface RawComment {
	end: number;
	start: number;
	type: "Block" | "Line";
	value: string;
}

function isRawComment(value: unknown): value is RawComment {
	if (typeof value !== "object" || value === null) return false;
	if (!("type" in value && "value" in value && "start" in value && "end" in value)) return false;
	return (
		(value.type === "Block" || value.type === "Line") &&
		typeof value.value === "string" &&
		typeof value.start === "number" &&
		typeof value.end === "number"
	);
}

function shouldSkip(character: string | undefined): boolean {
	return character === undefined || WHITESPACE.test(character);
}

function findCommentAt(comments: ReadonlyArray<HarnessComment>, index: number): HarnessComment | undefined {
	return comments.find((comment) => comment.range[0] === index);
}

function readTokenEnd(text: string, start: number): number {
	const character = text[start];
	if (character === undefined) return start + 1;
	if (character === "'" || character === '"') return readStringEnd(text, start, character);
	if (character === "`") return readTemplateEnd(text, start);
	if (DECIMAL_DIGIT.test(character)) return readNumberEnd(text, start);
	if (IDENTIFIER_START.test(character)) return readIdentifierEnd(text, start);

	for (const punctuator of MULTI_CHARACTER_PUNCTUATORS) {
		if (text.startsWith(punctuator, start)) return start + punctuator.length;
	}

	return start + 1;
}

function readStringEnd(text: string, start: number, quote: string): number {
	let index = start + 1;
	while (index < text.length) {
		const character = text[index];
		if (character === "\\") {
			index += 2;
			continue;
		}
		if (character === quote) return index + 1;
		index += 1;
	}
	return index;
}

function readTemplateEnd(text: string, start: number): number {
	let index = start + 1;
	while (index < text.length) {
		const character = text[index];
		if (character === "\\") {
			index += 2;
			continue;
		}
		if (character === "`") return index + 1;
		index += 1;
	}
	return index;
}

function readNumberEnd(text: string, start: number): number {
	let index = start + 1;
	while (index < text.length) {
		const character = text[index];
		if (character === undefined || !NUMBER_PART.test(character)) break;
		index += 1;
	}
	return index;
}

function readIdentifierEnd(text: string, start: number): number {
	let index = start + 1;
	while (index < text.length) {
		const character = text[index];
		if (character === undefined || !IDENTIFIER_PART.test(character)) break;
		index += 1;
	}
	return index;
}

function classifyToken(value: string): string {
	if (IDENTIFIER_START.test(value[0] ?? "")) return "Identifier";
	if (DECIMAL_DIGIT.test(value[0] ?? "")) return "Numeric";
	if (value.startsWith("'") || value.startsWith('"')) return "String";
	if (value.startsWith("`")) return "Template";
	return "Punctuator";
}
