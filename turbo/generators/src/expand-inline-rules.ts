const INLINE_RULES_REGEXP = /^\t{3}rules: \[(?<entries>.+)\],$/u;
const ENTRY_SEPARATOR_REGEXP = /(?<=\}), (?=\{)/u;
const RULES_PREFIX = "\t\t\trules: [";

/**
 * Puts a manifest category's `rules` list on separate lines. The formatters
 * collapse a short list onto one line, and insertion needs one entry per line.
 *
 * @param lines - The manifest's lines, edited in place.
 * @param from - The index to start looking for the list from.
 */
export function expandInlineRules(lines: Array<string>, from: number): void {
	const index = lines.findIndex((line, lineIndex) => lineIndex >= from && line.startsWith(RULES_PREFIX));
	const entries = INLINE_RULES_REGEXP.exec(lines[index] ?? "")?.groups?.entries;
	if (entries === undefined) return;

	const expanded = entries.split(ENTRY_SEPARATOR_REGEXP).map((entry) => `\t\t\t\t${entry},`);
	lines.splice(index, 1, RULES_PREFIX, ...expanded, "\t\t\t],");
}
