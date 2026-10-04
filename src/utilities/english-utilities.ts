import { programming } from "verb-corpus";

const BLOCKED_BASE = new Set(["file", "string"] satisfies ReadonlyArray<string>);
const BASE_VERBS = new Set(
	[
		...programming,
		...([
			"are",
			"can",
			"could",
			"did",
			"error",
			"from",
			"has",
			"info",
			"is",
			"may",
			"might",
			"must",
			"next",
			"noop",
			"off",
			"on",
			"over",
			"shall",
			"should",
			"to",
			"will",
			"would",
		] satisfies ReadonlyArray<string>),
	].filter((verb) => !BLOCKED_BASE.has(verb)),
);

interface StartsWithVerbOptions {
	readonly extraAllowList?: ReadonlyArray<string> | undefined;
	readonly extraDenyList?: ReadonlyArray<string> | undefined;
}

type StartsWithTuple = readonly [doesStartWith: boolean, prefix: string];

export function startsWithVerb(
	functionName: string,
	{ extraAllowList = [], extraDenyList = [] }: StartsWithVerbOptions,
): StartsWithTuple {
	let endIndex = 0;
	while (endIndex < functionName.length) {
		const unicode = functionName.codePointAt(endIndex);
		if (unicode === undefined || (unicode >= 65 && unicode <= 90)) break;
		endIndex += 1;
	}

	const prefix = functionName.slice(0, endIndex);
	if (prefix.length === 0) return [true, prefix];
	if (extraDenyList.includes(prefix)) return [false, prefix];

	return [BASE_VERBS.has(prefix) || extraAllowList.includes(prefix), prefix];
}
