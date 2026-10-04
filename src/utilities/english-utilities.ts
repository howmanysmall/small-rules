import { complete } from "verb-corpus";

const AUXILIARY_VERBS = [
	"am",
	"are",
	"be",
	"been",
	"being",
	"can",
	"could",
	"did",
	"does",
	"had",
	"has",
	"have",
	"having",
	"is",
	"may",
	"might",
	"must",
	"needs",
	"ought",
	"shall",
	"should",
	"was",
	"were",
	"will",
	"would",
] satisfies ReadonlyArray<string>;

const ALLOW_LIST = [
	"error",
	"from",
	"info",
	"next",
	"noop",
	"noOperation",
	"off",
	"on",
	"over",
	"to",
] satisfies ReadonlyArray<string>;

interface StartsWithVerbOptions {
	readonly extraAllowList?: ReadonlyArray<string> | undefined;
	readonly extraDenyList?: ReadonlyArray<string> | undefined;
}

type StartsWithTuple = readonly [doesStartWith: boolean, prefix: string];

const BASE_ALLOW = new Set<string>(complete);
for (const verb of AUXILIARY_VERBS) BASE_ALLOW.add(verb);
for (const verb of ALLOW_LIST) BASE_ALLOW.add(verb);

const BASE_DENY = new Set<string>(["file", "string"] satisfies ReadonlyArray<string>);

const EMPTY_LIST: ReadonlyArray<string> = [];
const NO_PREFIX: StartsWithTuple = [true, ""];

const CHAR_CODE_A = 65;
const CHAR_CODE_Z = 90;

function getLowercasePrefix(functionName: string): string {
	const { length } = functionName;
	let index = 0;
	while (index < length) {
		const unicode = functionName.codePointAt(index);
		if (unicode === undefined || (unicode >= CHAR_CODE_A && unicode <= CHAR_CODE_Z)) break;
		index += 1;
	}
	return (index === length ? functionName : functionName.slice(0, index)).trim();
}

export function startsWithVerb(
	functionName: string,
	{ extraAllowList = EMPTY_LIST, extraDenyList = EMPTY_LIST }: StartsWithVerbOptions,
): StartsWithTuple {
	const prefix = getLowercasePrefix(functionName);
	if (prefix.length === 0) return NO_PREFIX;

	if (BASE_DENY.has(prefix) || extraDenyList.includes(prefix)) return [false, prefix];
	return [BASE_ALLOW.has(prefix) || extraAllowList.includes(prefix), prefix];
}
