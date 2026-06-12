import type { Detector } from "./detector";

const WHITESPACE_GLOBAL_REGEX = /\s+/gu;

function countOccurrences(text: string, pattern: string): number {
	if (pattern === "") return text.length + 1;

	let count = 0;
	let searchIndex = 0;

	while (searchIndex <= text.length - pattern.length) {
		const matchIndex = text.indexOf(pattern, searchIndex);
		if (matchIndex === -1) break;

		count += 1;
		searchIndex = matchIndex + pattern.length;
	}

	return count;
}

interface StringPattern {
	readonly pattern: string;
	readonly type: "string";
}

interface RegExpPattern {
	readonly pattern: RegExp;
	readonly type: "regexp";
}

type CompiledPattern = RegExpPattern | StringPattern;

/**
 * Creates a detector that finds patterns in compressed text (whitespace removed). Supports both string literals and
 * RegExp patterns.
 *
 * @param probability - Base probability (0-1).
 * @param patterns - Patterns to detect (strings are escaped, RegExp used as-is).
 * @returns Detector instance.
 */
export function createContainsDetector(probability: number, patterns: ReadonlyArray<RegExp | string>): Detector {
	const compiledPatterns: ReadonlyArray<CompiledPattern> = patterns.map((pattern) =>
		typeof pattern === "string"
			? { pattern, type: "string" }
			: { pattern: new RegExp(pattern.source, "gu"), type: "regexp" },
	);

	return {
		probability,
		scan(line: string): number {
			const compressed = line.replace(WHITESPACE_GLOBAL_REGEX, "");
			let total = 0;

			for (const pattern of compiledPatterns) {
				if (pattern.type === "string") {
					total += countOccurrences(compressed, pattern.pattern);
					continue;
				}

				pattern.pattern.lastIndex = 0;
				const matches = compressed.match(pattern.pattern);
				if (matches) total += matches.length;
			}

			return total;
		},
	};
}
