import { DICTIONARY_VERBS } from "$oxc-generated/dictionary-verbs";

const AUXILIARY_VERBS = [
	"am",
	"are",
	"be",
	"been",
	"being",
	"can",
	"could",
	"did",
	"had",
	"has",
	"have",
	"having",
	"is",
	"may",
	"might",
	"must",
	"ought",
	"shall",
	"should",
	"was",
	"were",
	"will",
	"would",
] satisfies ReadonlyArray<string>;

// Programming jargon that general English dictionaries only know as nouns, if
// at all.
const PROGRAMMING_VERBS = [
	"archive",
	"authenticate",
	"autofocus",
	"autosave",
	"backfill",
	"bisect",
	"bookmark",
	"bootstrap",
	"broadcast",
	"bundle",
	"cache",
	"checkout",
	"cleanup",
	"colorize",
	"configure",
	"crop",
	"dasherize",
	"decrement",
	"dedupe",
	"deduplicate",
	"denormalize",
	"dequeue",
	"deregister",
	"destructure",
	"diff",
	"duplicate",
	"echo",
	"enumerate",
	"exec",
	"finalize",
	"flush",
	"fork",
	"forward",
	"hash",
	"hoist",
	"hydrate",
	"increment",
	"indent",
	"instantiate",
	"intercept",
	"iterate",
	"jsonify",
	"kebabize",
	"lerp",
	"lookup",
	"marshal",
	"minify",
	"mirror",
	"mock",
	"monitor",
	"mount",
	"paginate",
	"pin",
	"ping",
	"pipe",
	"pluralize",
	"prefetch",
	"preload",
	"preprocess",
	"promisify",
	"proxy",
	"prune",
	"purge",
	"randomize",
	"rebase",
	"recompute",
	"recurse",
	"refactor",
	"refetch",
	"rehash",
	"rehydrate",
	"reindex",
	"remap",
	"reorder",
	"repaint",
	"rerender",
	"resize",
	"rewind",
	"rollback",
	"sanitize",
	"scale",
	"scan",
	"score",
	"seed",
	"shutdown",
	"singularize",
	"slugify",
	"snakeify",
	"snapshot",
	"stash",
	"substitute",
	"swap",
	"swipe",
	"tag",
	"teardown",
	"titleize",
	"tokenize",
	"transpile",
	"tween",
	"uncapitalize",
	"uninstall",
	"unlink",
	"unmarshal",
	"unmount",
	"unshift",
	"unwatch",
	"upsert",
	"yield",
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

const BASE_ALLOW = new Set<string>(DICTIONARY_VERBS);

for (const verb of AUXILIARY_VERBS) {
	BASE_ALLOW.add(verb);
}

for (const verb of PROGRAMMING_VERBS) {
	BASE_ALLOW.add(verb);
}

for (const verb of ALLOW_LIST) {
	BASE_ALLOW.add(verb);
}

const BASE_DENY = new Set<string>(["file", "string"] satisfies ReadonlyArray<string>);

const EMPTY_LIST: ReadonlyArray<string> = [];
const NO_PREFIX: StartsWithTuple = [true, ""];

const CHAR_CODE_A = 65;
const CHAR_CODE_Z = 90;
const CHAR_CODE_DOLLAR = 36;
const CHAR_CODE_UNDERSCORE = 95;

/**
 * Counts the `_` and `$` characters that open a name.
 *
 * @param functionName - The name to read.
 * @returns How many sigil characters the name starts with.
 */
function countLeadingSigils(functionName: string): number {
	const { length } = functionName;
	let index = 0;
	while (index < length) {
		const unicode = functionName.codePointAt(index);
		if (unicode !== CHAR_CODE_DOLLAR && unicode !== CHAR_CODE_UNDERSCORE) break;
		index += 1;
	}

	return index;
}

/**
 * Reads the lowercase run of a name that starts at `start`.
 *
 * @param functionName - The name to read.
 * @param start - Where the run begins.
 * @returns The run, trimmed of whitespace.
 */
function readLowercaseRun(functionName: string, start: number): string {
	const { length } = functionName;
	let index = start;
	while (index < length) {
		const unicode = functionName.codePointAt(index);
		if (unicode === undefined || (unicode >= CHAR_CODE_A && unicode <= CHAR_CODE_Z)) break;
		index += 1;
	}

	return functionName.slice(start, index).trim();
}

/**
 * Reads the first word of a name. Leading `_` and `$` are skipped unless
 * nothing lowercase follows them.
 *
 * @param functionName - The name to read.
 * @returns The first word in lowercase form.
 */
function getLowercasePrefix(functionName: string): string {
	const sigilCount = countLeadingSigils(functionName);
	if (sigilCount > 0) {
		const prefix = readLowercaseRun(functionName, sigilCount);
		if (prefix.length > 0) return prefix;
	}

	return readLowercaseRun(functionName, 0);
}

function isAllowed(word: string, extraAllowList: ReadonlyArray<string>): boolean {
	return BASE_ALLOW.has(word) || extraAllowList.includes(word);
}

function isDenied(word: string, extraDenyList: ReadonlyArray<string>): boolean {
	return BASE_DENY.has(word) || extraDenyList.includes(word);
}

function getThirdPersonBase(word: string, extraAllowList: ReadonlyArray<string>): string | undefined {
	if (word.endsWith("ies")) {
		const base = `${word.slice(0, -3)}y`;
		if (isAllowed(base, extraAllowList)) return base;
	}

	if (word.endsWith("es")) {
		const base = word.slice(0, -2);
		if (isAllowed(base, extraAllowList)) return base;
	}

	if (word.endsWith("s")) {
		const base = word.slice(0, -1);
		if (isAllowed(base, extraAllowList)) return base;
	}

	return undefined;
}

export function startsWithVerb(
	functionName: string,
	{ extraAllowList = EMPTY_LIST, extraDenyList = EMPTY_LIST }: StartsWithVerbOptions,
): StartsWithTuple {
	const prefix = getLowercasePrefix(functionName);
	if (prefix.length === 0) return NO_PREFIX;

	if (isDenied(prefix, extraDenyList)) {
		return [false, prefix];
	}

	if (isAllowed(prefix, extraAllowList)) {
		return [true, prefix];
	}

	const base = getThirdPersonBase(prefix, extraAllowList);
	return [base !== undefined && !isDenied(base, extraDenyList), prefix];
}
