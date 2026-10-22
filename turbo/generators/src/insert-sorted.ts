import { compareWithLocale } from "@small-rules/string-utilities/compare-with-locale";

interface KeyedLine {
	readonly key: string;
	readonly index: number;
}

function readKey(pattern: RegExp, text: string): string | undefined {
	return pattern.exec(text)?.groups?.key;
}

/**
 * Inserts `line` into the run of lines matching `pattern`, keeping the run in
 * the order `compareWithLocale` gives, which is the order the lint enforces.
 *
 * @param lines - The file's lines, edited in place.
 * @param range - The first and last index the run may span.
 * @param pattern - Matches a line of the run and captures its sort key as `key`.
 * @param line - The line to insert.
 */
export function insertSorted(
	lines: Array<string>,
	range: readonly [start: number, end: number],
	pattern: RegExp,
	line: string,
): void {
	const [start, end] = range;
	const key = readKey(pattern, line) ?? line;
	const run = lines.slice(start, end + 1).flatMap((existing, offset): ReadonlyArray<KeyedLine> => {
		const existingKey = readKey(pattern, existing);
		return existingKey === undefined ? [] : [{ key: existingKey, index: start + offset }];
	});

	const last = run.at(-1);
	if (last === undefined) {
		throw new Error(`Found no line matching ${pattern.source}.`);
	}

	const next = run.find((entry) => compareWithLocale(entry.key, key) > 0);
	lines.splice(next?.index ?? last.index + 1, 0, line);
}
