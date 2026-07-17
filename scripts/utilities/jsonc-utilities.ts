import { regex } from "arktype";
import { applyEdits, findNodeAtLocation, modify, parse, parseTree } from "jsonc-parser";
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

function isInlineArrayNode(updatedContent: string, parentPath: ReadonlyArray<string | number>): boolean {
	if (parentPath.length === 0) return false;

	try {
		const root = parseTree(updatedContent);
		if (root === undefined) return false;

		const parentNode = findNodeAtLocation(root, [...parentPath]);
		if (parentNode?.type !== "array") return false;

		return !updatedContent.slice(parentNode.offset, parentNode.offset + parentNode.length).includes("\n");
	} catch {
		return false;
	}
}

function formatInsertionEdit(edit: { content: string; length: number }, indent: string, inlineSpace: boolean): void {
	if (edit.content.startsWith(",")) edit.content = `,${indent}${edit.content.slice(1)}`;
	else if (edit.content.length > 0 && !inlineSpace) edit.content = `${indent}${edit.content}`;

	edit.content = edit.content.replaceAll(MISSING_SPACE_AFTER_COLON_REGEXP, '": ');
}

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
		const options = change.op === "add" ? { isArrayInsertion: true } : {};
		const edits = modify(updatedContent, change.path, change.value, options);

		for (const edit of edits) {
			if (edit.length > 0) continue;

			const inlineSpace = isInlineArrayNode(updatedContent, change.path.slice(0, -1));
			const indent = inlineSpace ? " " : `\n${indentation.repeat(change.path.length)}`;

			formatInsertionEdit(edit, indent, inlineSpace);
		}

		updatedContent = applyEdits(updatedContent, edits);
	}

	return updatedContent;
}
