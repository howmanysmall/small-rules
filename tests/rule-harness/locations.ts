import type { Position, Range, SourceLocation } from "./types";

export interface LocationIndex {
	lineStarts: ReadonlyArray<number>;
	text: string;
}

export function createLocationIndex(text: string): LocationIndex {
	const lineStarts = [0];
	for (let index = 0; index < text.length; index += 1) {
		if (text.startsWith("\n", index)) lineStarts.push(index + 1);
	}
	return { lineStarts, text };
}

export function createRange(start: number, end: number): Range {
	return [start, end];
}

export function locationForRange(index: LocationIndex, range: Range): SourceLocation {
	return {
		end: positionForIndex(index, range[1]),
		start: positionForIndex(index, range[0]),
	};
}

export function positionForIndex(index: LocationIndex, offset: number): Position {
	let low = 0;
	let high = index.lineStarts.length - 1;

	while (low <= high) {
		const middle = Math.floor((low + high) / 2);
		const lineStart = index.lineStarts[middle];
		if (lineStart === undefined) break;
		const nextLineStart = index.lineStarts[middle + 1];

		if (offset < lineStart) {
			high = middle - 1;
			continue;
		}

		if (nextLineStart !== undefined && offset >= nextLineStart) {
			low = middle + 1;
			continue;
		}

		return { column: offset - lineStart, line: middle + 1 };
	}

	const lastLine = index.lineStarts.length;
	const lastLineStart = index.lineStarts.at(-1) ?? 0;
	return { column: offset - lastLineStart, line: lastLine };
}
