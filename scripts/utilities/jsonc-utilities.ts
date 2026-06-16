import { regex } from "arktype";
import { applyEdits, modify, parse } from "jsonc-parser";
import { diff } from "just-diff";

// oxlint-disable-next-line unicorn/prefer-string-raw -- this is for `regex`
const INDENTATION_REGEXP = regex("^(?<whitespace>\\s+)", "v");

function detectIndentation(content: string): string {
	const lines = content.split("\n");
	for (const line of lines) {
		const match = INDENTATION_REGEXP.exec(line);
		if (match) return match.groups.whitespace;
	}
	return "\t";
}

const MISSING_SPACE_AFTER_COLON_REGEXP = /":(?!\s)/gv;

/**
 * Edits a JSONC string while preserving comments.
 *
 * @param content The JSONC content to edit.
 * @param validator A function that validates and returns the parsed data.
 * @param mutate A function that receives a draft of the data and returns the modified version.
 * @returns The modified JSONC string with comments preserved.
 */
export function editJsonc<TIn extends object>(
	content: string,
	validator: (data: unknown) => TIn,
	mutate: (draft: TIn) => TIn,
): string {
	const parsed = validator(parse(content));
	const indentation = detectIndentation(content);

	const modified = mutate(structuredClone(parsed));
	const changes = diff(parsed, modified);

	let updatedContent = content;
	for (const change of changes) {
		const edits = modify(updatedContent, change.path, change.value, {});

		for (const edit of edits) {
			if (edit.length === 0) {
				const indentString = `\n${indentation.repeat(change.path.length)}`;

				if (edit.content.startsWith(",")) edit.content = `,${indentString}${edit.content.slice(1)}`;
				else if (edit.content.length > 0) edit.content = `${indentString}${edit.content}`;

				edit.content = edit.content.replaceAll(MISSING_SPACE_AFTER_COLON_REGEXP, '": ');
			}
		}

		updatedContent = applyEdits(updatedContent, edits);
	}

	return updatedContent;
}

function validateObject(value: unknown): object {
	if (typeof value === "object" && value !== null) return value;

	const error = new TypeError(`Expected object but received ${typeof value}`);
	Error.captureStackTrace(error, validateObject);
	throw error;
}

export function editJsoncNoValidate(content: string, mutate: (draft: object) => object): string {
	const parsed = validateObject(parse(content));
	const indentation = detectIndentation(content);

	const modified = mutate(structuredClone(parsed));
	const changes = diff(parsed, modified);

	let updatedContent = content;
	for (const change of changes) {
		const edits = modify(updatedContent, change.path, change.value, {});

		for (const edit of edits) {
			if (edit.length === 0) {
				const indentString = `\n${indentation.repeat(change.path.length)}`;

				if (edit.content.startsWith(",")) edit.content = `,${indentString}${edit.content.slice(1)}`;
				else if (edit.content.length > 0) edit.content = `${indentString}${edit.content}`;

				edit.content = edit.content.replaceAll(MISSING_SPACE_AFTER_COLON_REGEXP, '": ');
			}
		}

		updatedContent = applyEdits(updatedContent, edits);
	}

	return updatedContent;
}
