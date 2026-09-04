import { isFix } from "./types";

import type { Fix, Fixer, Range } from "./types";

export const fixer: Fixer = {
	insertTextAfter(node, text): Fix {
		return { range: createCollapsedRange(node.range[1]), text };
	},
	insertTextAfterRange(range, text): Fix {
		return { range: createCollapsedRange(range[1]), text };
	},
	insertTextBefore(node, text): Fix {
		return { range: createCollapsedRange(node.range[0]), text };
	},
	insertTextBeforeRange(range, text): Fix {
		return { range: createCollapsedRange(range[0]), text };
	},
	remove(node): Fix {
		return { range: node.range, text: "" };
	},
	removeRange(range): Fix {
		return { range, text: "" };
	},
	replaceText(node, text): Fix {
		return { range: node.range, text };
	},
	replaceTextRange(range, text): Fix {
		return { range, text };
	},
};

export function applyFixes(text: string, fixResult: Fix | ReadonlyArray<Fix> | undefined): string | undefined {
	if (fixResult === undefined) return undefined;
	const fixes = collectFixes(fixResult);
	const sorted = fixes.toSorted((left, right) => left.range[0] - right.range[0] || left.range[1] - right.range[1]);

	let output = "";
	let position = 0;
	for (const fix of sorted) {
		const { range, text: replacementText } = fix;
		const [start, end] = range;
		if (start < position) continue;
		output += text.slice(position, start);
		output += replacementText;
		position = end;
	}
	output += text.slice(position);
	return output;
}

function collectFixes(fixResult: Fix | ReadonlyArray<Fix>): Array<Fix> {
	const fixes = new Array<Fix>();
	if (Array.isArray(fixResult)) {
		for (const fix of fixResult) {
			if (isFix.allows(fix)) fixes.push(fix);
		}
		return fixes;
	}
	if (isFix.allows(fixResult)) fixes.push(fixResult);
	return fixes;
}

function createCollapsedRange(position: number): Range {
	return [position, position];
}
