import { Predicate } from "effect";

import type { Comment, Location, SourceCode } from "oxlint-plugin-utilities";
import type { UnknownRecord, Writable } from "type-fest";

const ESLINT_DISABLE = "eslint-disable";
const ESLINT_DISABLE_LINE = "eslint-disable-line";
const ESLINT_DISABLE_NEXT_LINE = "eslint-disable-next-line";
const ESLINT_ENABLE = "eslint-enable";
const OXLINT_DISABLE = "oxlint-disable";
const OXLINT_DISABLE_LINE = "oxlint-disable-line";
const OXLINT_DISABLE_NEXT_LINE = "oxlint-disable-next-line";
const OXLINT_ENABLE = "oxlint-enable";

const LINE_COMMENT_PATTERN = /^(?:eslint|oxlint)-disable-(?:next-)?line$/u;
const DELIMITER = /[\s,]+/gu;
const DIRECTIVE_VALUE_SEPARATOR = /\s/u;
const DISABLE_DIRECTIVE_KINDS = new Set([
	ESLINT_DISABLE,
	ESLINT_DISABLE_LINE,
	ESLINT_DISABLE_NEXT_LINE,
	OXLINT_DISABLE,
	OXLINT_DISABLE_LINE,
	OXLINT_DISABLE_NEXT_LINE,
]);
const DISABLE_OR_ENABLE_DIRECTIVE_KINDS = new Set([...DISABLE_DIRECTIVE_KINDS, ESLINT_ENABLE, OXLINT_ENABLE]);
const DIRECTIVE_KINDS = new Set([
	"eslint",
	"eslint-env",
	ESLINT_DISABLE,
	ESLINT_DISABLE_LINE,
	ESLINT_DISABLE_NEXT_LINE,
	ESLINT_ENABLE,
	"exported",
	"global",
	"globals",
	"oxlint",
	"oxlint-env",
	OXLINT_DISABLE,
	OXLINT_DISABLE_LINE,
	OXLINT_DISABLE_NEXT_LINE,
	OXLINT_ENABLE,
]);

interface Directive {
	readonly comment: Comment;
	readonly ruleId: string | undefined;
}

export interface DirectiveComment {
	readonly comment: Comment;
	readonly description?: string | undefined;
	readonly kind: string;
	readonly value?: string | undefined;
}

interface ColumnLine {
	readonly column: number;
	readonly line: number;
}

interface DividedDirectiveComment {
	readonly description: string | undefined;
	readonly text: string;
}

interface ForceLocation {
	readonly end: ColumnLine;
	readonly start: ColumnLine;
}

interface DisabledArea {
	readonly comment: Comment;
	readonly end: ColumnLine | undefined;
	readonly kind: "block" | "line";
	readonly ruleId: string | undefined;
	readonly start: ColumnLine;
}

export interface DisabledAreaCollection {
	readonly areas: Array<DisabledArea>;
	readonly duplicateDisableDirectives: Array<Directive>;
	readonly numberOfRelatedDisableDirectives: Map<Comment, number>;
	readonly unusedEnableDirectives: Array<Directive>;
}

export function isDisableDirectiveKind(kind: string): boolean {
	return DISABLE_DIRECTIVE_KINDS.has(kind);
}

export function isDisableOrEnableDirectiveKind(kind: string): boolean {
	return DISABLE_OR_ENABLE_DIRECTIVE_KINDS.has(kind);
}

export function getOptionalStringArrayProperty(
	value: null | undefined | UnknownRecord,
	propertyName: string,
): ReadonlyArray<string> | undefined {
	if (!Predicate.isObject(value)) return undefined;

	const property = value[propertyName];
	if (property === undefined || !Array.isArray(property)) return undefined;

	const strings = new Array<string>();
	let size = 0;
	for (const item of property) {
		if (!Predicate.isString(item)) return undefined;
		strings[size++] = item;
	}

	return strings;
}

export function parseDirectiveComment(comment: Comment): DirectiveComment | undefined {
	if (!Predicate.isString(comment.value)) return undefined;

	const parsed = parseDirectiveText(comment.value);
	if (parsed === undefined) return undefined;

	const lineCommentSupported = LINE_COMMENT_PATTERN.test(parsed.kind);
	if (
		(!lineCommentSupported && comment.type === "Line") ||
		(comment.loc.start.line !== comment.loc.end.line &&
			(parsed.kind === ESLINT_DISABLE_LINE || parsed.kind === OXLINT_DISABLE_LINE))
	) {
		return undefined;
	}

	return {
		comment,
		description: parsed.description,
		kind: parsed.kind,
		value: parsed.value,
	};
}

function parseDirectiveText(
	textToParse: string,
): Readonly<{ description: string | undefined; kind: string; value: string }> | undefined {
	const { description, text } = divideDirectiveComment(textToParse);
	const valueStart = text.search(DIRECTIVE_VALUE_SEPARATOR);
	const directiveText = valueStart === -1 ? text : text.slice(0, valueStart);
	if (!DIRECTIVE_KINDS.has(directiveText)) return undefined;

	return {
		description,
		kind: directiveText,
		value: valueStart === -1 ? "" : text.slice(valueStart).trim(),
	};
}

const DIRECTIVE_REGEXP = /\s-{2,}\s/u;

function divideDirectiveComment(value: string): DividedDirectiveComment {
	const divided = value.split(DIRECTIVE_REGEXP);
	const [text, description] = divided;
	/* v8 ignore next -- @preserve String.prototype.split always returns at least one item. */
	if (text === undefined) {
		return {
			description: undefined,
			text: "",
		};
	}

	return {
		description: description?.trim(),
		text: text.trim(),
	};
}

export function lte(firstLine: ColumnLine, secondLine: ColumnLine): boolean {
	return (
		firstLine.line < secondLine.line ||
		(firstLine.line === secondLine.line && firstLine.column <= secondLine.column)
	);
}

export function toForceLocation(location: Location): ForceLocation {
	return {
		end: location.end,
		start: { column: 0, line: location.start.line },
	};
}

const LINES_REGEXP = /\r\n|[\r\n\u2028\u2029]/u;

export function toRuleIdLocation(comment: Comment, ruleId?: string): Location {
	if (ruleId === undefined) return toForceLocation(comment.loc);
	if (!Predicate.isString(comment.value)) return comment.loc;

	const lines = comment.value.split(LINES_REGEXP);
	const [firstLine] = lines;
	/* v8 ignore next -- @preserve String.prototype.split always returns at least one item. */
	if (firstLine === undefined) return comment.loc;

	const ruleIdPattern = new RegExp(`([\\s,]|^)${escapeStringRegexp(ruleId)}(?:[\\s,]|$)`, "u");

	const commentStart = comment.loc.start;
	const firstMatch = ruleIdPattern.exec(firstLine);
	if (firstMatch !== null) {
		const [, leadingBoundary] = firstMatch;
		/* v8 ignore next -- @preserve The regexp always captures the leading boundary when it matches. */
		if (leadingBoundary === undefined) return comment.loc;

		return {
			end: {
				column: 2 + commentStart.column + firstMatch.index + leadingBoundary.length + ruleId.length,
				line: commentStart.line,
			},
			start: {
				column: 2 + commentStart.column + firstMatch.index + leadingBoundary.length,
				line: commentStart.line,
			},
		};
	}

	for (let index = 1; index < lines.length; index += 1) {
		const line = lines[index];
		/* v8 ignore next -- @preserve Dense arrays returned by split cannot be missing inside bounds. */
		if (line === undefined) continue;

		const lineMatch = ruleIdPattern.exec(line);
		/* v8 ignore next -- @preserve multiline directive continuations only enter here when they contain rule ids. */
		if (lineMatch !== null) {
			const [, leadingBoundary] = lineMatch;
			/* v8 ignore next -- @preserve The regexp always captures the leading boundary when it matches. */
			if (leadingBoundary === undefined) continue;

			return {
				end: {
					column: lineMatch.index + leadingBoundary.length + ruleId.length,
					line: commentStart.line + index,
				},
				start: {
					column: lineMatch.index + leadingBoundary.length,
					line: commentStart.line + index,
				},
			};
		}
	}

	return comment.loc;
}

const REGEXP_REGEXP = /[|\\{}()[\]^$+*?.]/gu;
const ESCAPE_FOR_REGEXP = String.raw`\$&`;
function escapeStringRegexp(string: string): string {
	return string.replaceAll(REGEXP_REGEXP, ESCAPE_FOR_REGEXP);
}

export function computeDisabledArea(sourceCode: SourceCode): DisabledAreaCollection {
	const collection: DisabledAreaCollection = {
		areas: [],
		duplicateDisableDirectives: [],
		numberOfRelatedDisableDirectives: new Map(),
		unusedEnableDirectives: [],
	};

	for (const comment of sourceCode.getAllComments()) {
		const directive = parseDirectiveComment(comment);
		if (directive === undefined) continue;

		const { kind } = directive;
		if (!isDisableOrEnableDirectiveKind(kind)) {
			continue;
		}

		const { start } = comment.loc;

		const ruleIds =
			directive.value !== undefined && directive.value !== "" ? directive.value.split(DELIMITER) : undefined;

		switch (kind) {
			case ESLINT_DISABLE:
			case OXLINT_DISABLE: {
				disable(collection, comment, start, ruleIds, "block");
				break;
			}

			case ESLINT_DISABLE_LINE:
			case OXLINT_DISABLE_LINE: {
				const { line } = start;
				disable(collection, comment, { column: 0, line }, ruleIds, "line");
				enable(collection, comment, { column: -1, line: line + 1 }, ruleIds, "line");
				break;
			}

			case ESLINT_DISABLE_NEXT_LINE:
			case OXLINT_DISABLE_NEXT_LINE: {
				const { line } = start;
				disable(collection, comment, { column: 0, line: line + 1 }, ruleIds, "line");
				enable(collection, comment, { column: -1, line: line + 2 }, ruleIds, "line");
				break;
			}

			case ESLINT_ENABLE:
			case OXLINT_ENABLE: {
				enable(collection, comment, start, ruleIds, "block");
				break;
			}
		}
	}

	return collection;
}

function disable(
	collection: DisabledAreaCollection,
	comment: Comment,
	location: ColumnLine,
	ruleIds: Array<string> | undefined,
	kind: "block" | "line",
): void {
	if (ruleIds === undefined) {
		if (getArea(collection.areas, undefined, location) !== undefined) {
			collection.duplicateDisableDirectives.push({
				comment,
				ruleId: undefined,
			});
		}
		collection.areas.push({
			comment,
			end: undefined,
			kind,
			ruleId: undefined,
			start: location,
		});
		return;
	}

	for (const ruleId of ruleIds) {
		if (getArea(collection.areas, ruleId, location) !== undefined) {
			collection.duplicateDisableDirectives.push({
				comment,
				ruleId,
			});
		}
		collection.areas.push({
			comment,
			end: undefined,
			kind,
			ruleId,
			start: location,
		});
	}
}

function enable(
	collection: DisabledAreaCollection,
	comment: Comment,
	location: ColumnLine,
	ruleIds: ReadonlyArray<string> | undefined,
	kind: "block" | "line",
): void {
	const relatedDisableDirectives = new Set<Comment>();

	if (ruleIds === undefined) {
		const used = closeMatchingAreas(collection.areas, location, kind, undefined, relatedDisableDirectives);
		if (!used) addUnusedEnableDirective(collection, comment, undefined);
		collection.numberOfRelatedDisableDirectives.set(comment, relatedDisableDirectives.size);
		return;
	}

	for (const ruleId of ruleIds) {
		const used = closeMatchingAreas(collection.areas, location, kind, ruleId, relatedDisableDirectives);
		if (!used) addUnusedEnableDirective(collection, comment, ruleId);
	}

	collection.numberOfRelatedDisableDirectives.set(comment, relatedDisableDirectives.size);
}

function closeMatchingAreas(
	areas: ReadonlyArray<Writable<DisabledArea>>,
	location: ColumnLine,
	kind: "block" | "line",
	ruleId: string | undefined,
	relatedDisableDirectives: Set<Comment>,
): boolean {
	let used = false;
	for (let index = areas.length - 1; index >= 0; index -= 1) {
		const area = areas[index];
		if (area === undefined || !isOpenMatchingArea(area, kind, ruleId)) continue;

		relatedDisableDirectives.add(area.comment);
		area.end = location;
		used = true;
	}

	return used;
}

function isOpenMatchingArea(area: DisabledArea, kind: "block" | "line", ruleId?: string): boolean {
	if (area.end !== undefined || area.kind !== kind) return false;
	return ruleId === undefined || area.ruleId === ruleId;
}

function addUnusedEnableDirective(collection: DisabledAreaCollection, comment: Comment, ruleId?: string): void {
	collection.unusedEnableDirectives.push({
		comment,
		ruleId,
	});
}

function getArea(
	areas: ReadonlyArray<DisabledArea>,
	ruleId: string | undefined,
	location: ColumnLine,
): DisabledArea | undefined {
	for (let index = areas.length - 1; index >= 0; index -= 1) {
		const area = areas[index];
		/* v8 ignore next -- @preserve Disabled areas are pushed internally, so sparse entries are impossible. */
		if (area === undefined) continue;

		/* v8 ignore start -- @preserve disable areas are created by this module with normalized bounds. */
		if (
			(area.ruleId === undefined || area.ruleId === ruleId) &&
			lte(area.start, location) &&
			(area.end === undefined || lte(location, area.end))
		) {
			return area;
		}
		/* v8 ignore stop -- @preserve */
	}
	return undefined;
}
