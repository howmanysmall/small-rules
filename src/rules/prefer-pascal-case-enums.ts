import { isStringRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isAsciiDigit(value: string): boolean {
	return value >= "0" && value <= "9";
}

function isAsciiLowercase(value: string): boolean {
	return value >= "a" && value <= "z";
}

function isAsciiUppercase(value: string): boolean {
	return value >= "A" && value <= "Z";
}

function isAsciiAlphanumeric(value: string): boolean {
	return isAsciiDigit(value) || isAsciiLowercase(value) || isAsciiUppercase(value);
}

function isWordBoundary(previous: string, current: string, next: string | undefined): boolean {
	if (isAsciiDigit(previous) !== isAsciiDigit(current)) return true;
	if (isAsciiLowercase(previous) && isAsciiUppercase(current)) return true;
	return isAsciiUppercase(previous) && isAsciiUppercase(current) && next !== undefined && isAsciiLowercase(next);
}

function pushSplitRun(words: Array<string>, run: string): void {
	let start = 0;

	for (let index = 1; index < run.length; index += 1) {
		const next = index + 1 < run.length ? run.charAt(index + 1) : undefined;
		if (!isWordBoundary(run.charAt(index - 1), run.charAt(index), next)) continue;
		words.push(run.slice(start, index));
		start = index;
	}

	words.push(run.slice(start));
}

function splitIntoWords(value: string): ReadonlyArray<string> {
	const words = new Array<string>();
	let runStart: number | undefined;

	for (let index = 0; index < value.length; index += 1) {
		if (isAsciiAlphanumeric(value.charAt(index))) {
			runStart ??= index;
			continue;
		}

		if (runStart === undefined) continue;
		pushSplitRun(words, value.slice(runStart, index));
		runStart = undefined;
	}

	if (runStart !== undefined) pushSplitRun(words, value.slice(runStart));
	return words;
}

function toPascalCase(value: string): string {
	const words = splitIntoWords(value);
	let result = "";

	for (const word of words) {
		/* v8 ignore next -- @preserve splitIntoWords pushes only non-empty alphanumeric runs. */
		if (word.length === 0) continue;
		result += `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
	}

	return result;
}

const IS_INTEGER = /^\d/u;

function getEnumMemberName(node: ESTree.TSEnumMember): string | undefined {
	if (node.id.type === "Identifier") return node.id.name;
	/* v8 ignore next -- @preserve TypeScript enum literal member names are parser string literals here. */
	if (node.id.type !== "Literal" || !isStringRaw(node.id.value)) return undefined;
	return IS_INTEGER.test(node.id.value) ? undefined : node.id.value;
}

const preferPascalCaseEnums = defineRule({
	createOnce(context): Visitor {
		return {
			TSEnumDeclaration(node): void {
				const identifier = node.id.name;
				if (toPascalCase(identifier) === identifier) return;

				context.report({
					data: { identifier },
					messageId: "notPascalCase",
					node: node.id,
				});
			},
			TSEnumMember(node): void {
				const identifier = getEnumMemberName(node);
				if (identifier === undefined || toPascalCase(identifier) === identifier) return;

				context.report({
					data: { identifier },
					messageId: "notPascalCase",
					node: node.id,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Enforce PascalCase names for enums and enum members.",
			recommended: true,
		},
		messages: {
			notPascalCase:
				"Enum '{{ identifier }}' uses non-standard casing. TypeScript convention requires PascalCase for enum names and members to distinguish them from variables (camelCase) and constants (UPPER_CASE). Rename to PascalCase: capitalize first letter of each word, no underscores.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default preferPascalCaseEnums;
