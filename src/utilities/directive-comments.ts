import type { Comment, SourceCode } from "oxlint-plugin-utilities";

const DIRECTIVE_PATTERN =
	/^(?<directive>(?:eslint|oxlint)(?:-(?:env|enable|disable(?:-(?:next-)?line)?))?|exported|globals?)(?:\s|$)/u;
const LINE_COMMENT_PATTERN = /^(?:eslint|oxlint)-disable-(?:next-)?line$/u;
const DELIMITER = /[\s,]+/gu;

export interface DirectiveComment {
	readonly comment: Comment;
	readonly description: string | undefined;
	readonly kind: string;
	readonly value: string | undefined;
}

interface DisabledArea {
	readonly comment: Comment;
	end: undefined | { column: number; line: number };
	readonly kind: "block" | "line";
	readonly ruleId: string | undefined;
	readonly start: { column: number; line: number };
}

export interface DisabledAreaCollection {
	readonly areas: Array<DisabledArea>;
	readonly duplicateDisableDirectives: Array<{
		comment: Comment;
		ruleId: string | undefined;
	}>;
	readonly numberOfRelatedDisableDirectives: Map<Comment, number>;
	readonly unusedEnableDirectives: Array<{
		comment: Comment;
		ruleId: string | undefined;
	}>;
}

export function getOptionalStringArrayProperty(value: unknown, propertyName: string): Array<string> | undefined {
	if (typeof value !== "object" || value === undefined || value === null) return undefined;

	const property: unknown = Reflect.get(value, propertyName);
	if (property === undefined || !Array.isArray(property)) return undefined;

	const strings = new Array<string>();
	let size = 0;
	for (const item of property) {
		if (typeof item !== "string") return undefined;
		strings[size++] = item;
	}

	return strings;
}

export function parseDirectiveComment(comment: Comment): DirectiveComment | undefined {
	const parsed = parseDirectiveText(comment.value);
	if (parsed === undefined) return undefined;

	const lineCommentSupported = LINE_COMMENT_PATTERN.test(parsed.kind);
	if (comment.type === "Line" && !lineCommentSupported) return undefined;

	if (
		(parsed.kind === "eslint-disable-line" || parsed.kind === "oxlint-disable-line") &&
		comment.loc.start.line !== comment.loc.end.line
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
): undefined | { description: string | undefined; kind: string; value: string } {
	const { description, text } = divideDirectiveComment(textToParse);
	const match = DIRECTIVE_PATTERN.exec(text);
	if (match === null) return undefined;

	const directiveText = match.groups?.directive;
	if (directiveText === undefined) return undefined;

	return {
		description,
		kind: directiveText,
		value: text.slice(match.index + directiveText.length).trim(),
	};
}

const DIRECTIVE_REGEXP = /\s-{2,}\s/u;

function divideDirectiveComment(value: string): {
	description: string | undefined;
	text: string;
} {
	const divided = value.split(DIRECTIVE_REGEXP);
	const [text, description] = divided;
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

export function lte(a: { column: number; line: number }, b: { column: number; line: number }): boolean {
	return a.line < b.line || (a.line === b.line && a.column <= b.column);
}

export function toForceLocation(location: {
	end: { column: number; line: number };
	start: { column: number; line: number };
}): { end: { column: number; line: number }; start: { column: number; line: number } } {
	return {
		end: location.end,
		start: { column: 0, line: location.start.line },
	};
}

const LINES_REGEXP = /\r\n|[\r\n\u2028\u2029]/u;

export function toRuleIdLocation(
	comment: Comment,
	ruleId: string | undefined,
): { end: { column: number; line: number }; start: { column: number; line: number } } {
	if (ruleId === undefined) return toForceLocation(comment.loc);

	const lines = comment.value.split(LINES_REGEXP);
	const [firstLine] = lines;
	if (firstLine === undefined) return comment.loc;

	const ruleIdPattern = new RegExp(`([\\s,]|^)${escapeStringRegexp(ruleId)}(?:[\\s,]|$)`, "u");

	const commentStart = comment.loc.start;
	const firstMatch = ruleIdPattern.exec(firstLine);
	if (firstMatch !== null) {
		// biome-ignore lint/nursery/useDestructuring: will produce ugly
		const leadingBoundary = firstMatch[1];
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
		if (line === undefined) continue;

		const lineMatch = ruleIdPattern.exec(line);
		if (lineMatch !== null) {
			// biome-ignore lint/nursery/useDestructuring: will produce ugly
			const leadingBoundary = lineMatch[1];
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
function escapeStringRegexp(string: string): string {
	return string.replaceAll(REGEXP_REGEXP, String.raw`\$&`);
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
		if (
			kind !== "eslint-disable" &&
			kind !== "eslint-enable" &&
			kind !== "eslint-disable-line" &&
			kind !== "eslint-disable-next-line" &&
			kind !== "oxlint-disable" &&
			kind !== "oxlint-enable" &&
			kind !== "oxlint-disable-line" &&
			kind !== "oxlint-disable-next-line"
		) {
			continue;
		}

		const ruleIds =
			directive.value !== undefined && directive.value !== "" ? directive.value.split(DELIMITER) : undefined;

		switch (kind) {
			case "eslint-disable":
			case "oxlint-disable": {
				disable(collection, comment, comment.loc.start, ruleIds, "block");
				break;
			}

			case "eslint-disable-line":
			case "oxlint-disable-line": {
				const { line } = comment.loc.start;
				disable(collection, comment, { column: 0, line }, ruleIds, "line");
				enable(collection, comment, { column: -1, line: line + 1 }, ruleIds, "line");
				break;
			}

			case "eslint-disable-next-line":
			case "oxlint-disable-next-line": {
				const { line } = comment.loc.start;
				disable(collection, comment, { column: 0, line: line + 1 }, ruleIds, "line");
				enable(collection, comment, { column: -1, line: line + 2 }, ruleIds, "line");
				break;
			}

			case "eslint-enable":
			case "oxlint-enable": {
				enable(collection, comment, comment.loc.start, ruleIds, "block");
				break;
			}
			// No default
		}
	}

	return collection;
}

function disable(
	collection: DisabledAreaCollection,
	comment: Comment,
	location: { column: number; line: number },
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
	location: { column: number; line: number },
	ruleIds: Array<string> | undefined,
	kind: "block" | "line",
): void {
	const relatedDisableDirectives = new Set<Comment>();

	if (ruleIds === undefined) {
		let used = false;
		for (let index = collection.areas.length - 1; index >= 0; index -= 1) {
			const area = collection.areas[index];
			if (area === undefined) continue;

			if (area.end === undefined && area.kind === kind) {
				relatedDisableDirectives.add(area.comment);
				area.end = location;
				used = true;
			}
		}
		if (!used) {
			collection.unusedEnableDirectives.push({
				comment,
				ruleId: undefined,
			});
		}
		collection.numberOfRelatedDisableDirectives.set(comment, relatedDisableDirectives.size);
		return;
	}

	for (const ruleId of ruleIds) {
		let used = false;
		for (let index = collection.areas.length - 1; index >= 0; index -= 1) {
			const area = collection.areas[index];
			if (area === undefined) continue;

			if (area.end === undefined && area.kind === kind && area.ruleId === ruleId) {
				relatedDisableDirectives.add(area.comment);
				area.end = location;
				used = true;
			}
		}
		if (!used) {
			collection.unusedEnableDirectives.push({
				comment,
				ruleId,
			});
		}
	}

	collection.numberOfRelatedDisableDirectives.set(comment, relatedDisableDirectives.size);
}

function getArea(
	areas: Array<DisabledArea>,
	ruleId: string | undefined,
	location: { column: number; line: number },
): DisabledArea | undefined {
	for (let index = areas.length - 1; index >= 0; index -= 1) {
		const area = areas[index];
		if (area === undefined) continue;

		if (
			(area.ruleId === undefined || area.ruleId === ruleId) &&
			lte(area.start, location) &&
			(area.end === undefined || lte(location, area.end))
		) {
			return area;
		}
	}
	return undefined;
}
