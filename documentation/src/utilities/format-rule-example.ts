import { Predicate } from "effect";
import { format } from "oxfmt";

import type { FormatConfig } from "oxfmt";

import type { RuleExample } from "./extract-rule-examples";

const FORMAT_CONFIGURATION = {
	arrowParens: "always",
	bracketSameLine: false,
	bracketSpacing: true,
	endOfLine: "lf",
	jsxSingleQuote: false,
	objectWrap: "preserve",
	printWidth: 80,
	quoteProps: "as-needed",
	semi: true,
	singleQuote: false,
	tabWidth: 2,
	trailingComma: "all",
	useTabs: false,
} satisfies FormatConfig;

function resolveFormatterFilename(language?: string): string {
	switch (language) {
		case "dts":
			return "example.d.ts";

		case "js":
		case "jsx":
		case "ts":
		case "tsx":
			return `example.${language}`;

		default:
			return "example.ts";
	}
}

function isBlankLine(line: string): boolean {
	return line.trim().length === 0;
}

function trimBlankEdgeLines(source: string): string {
	const lines = source.split("\n");
	let start = 0;
	while (start < lines.length && isBlankLine(lines[start] ?? "")) {
		start += 1;
	}

	let end = lines.length;
	while (end > start && isBlankLine(lines[end - 1] ?? "")) {
		end -= 1;
	}

	return lines.slice(start, end).join("\n");
}

function hasFormattableOutput(output: RuleExample["output"]): output is string {
	return Predicate.isString(output) && output.length > 0;
}

/**
 * Formats a code snippet for documentation display with `oxfmt`.
 *
 * @param source - The raw code snippet to format.
 * @param language - The example language identifier used to pick parser mode.
 * @returns The formatted snippet without a trailing newline.
 * @rejects {Error} When `oxfmt` reports a parse or format error.
 */
export async function formatExampleSnippetAsync(source: string, language?: string): Promise<string> {
	const result = await format(resolveFormatterFilename(language), source, FORMAT_CONFIGURATION);
	const [firstError] = result.errors;
	if (firstError !== undefined) {
		throw new Error(`Failed to format example snippet: ${firstError.message}`);
	}

	return result.code.trimEnd();
}

/**
 * Formats the `code` and optional `output` fields of an extracted rule example.
 *
 * @param example - The extracted rule example metadata and source strings.
 * @returns The formatted example ready for rendering.
 * @rejects {Error} When formatting `code` or `output` fails.
 */
export async function formatRuleExampleAsync(example: RuleExample): Promise<RuleExample> {
	if (example.preserveFormatting === true) {
		const code = trimBlankEdgeLines(example.code);
		if (hasFormattableOutput(example.output)) {
			return { ...example, code, output: trimBlankEdgeLines(example.output) };
		}

		return { ...example, code };
	}

	const code = await formatExampleSnippetAsync(example.code, example.language);
	if (hasFormattableOutput(example.output)) {
		const output = await formatExampleSnippetAsync(example.output, example.language);
		return { ...example, code, output };
	}

	return { ...example, code };
}
