import { evilTernary } from "$oxc-utilities/evil-ternary-utilities";
import { isRecord, isStringArray, isStringRaw, isStringRecord } from "$oxc-utilities/type-utilities";

import {
	DEFAULT_ALLOW_LIST,
	DEFAULT_ALLOW_PROPERTY_ACCESS,
	DEFAULT_IGNORE,
	DEFAULT_REPLACEMENTS,
	DEFAULT_SHORTHANDS,
	IS_ALPHABETIC,
	MESSAGE_ID_REPLACE,
	MESSAGE_ID_SUGGESTION,
	WORD_SPLIT_PATTERN,
} from "./constants";

import type {
	ImportCheckOption,
	MessageIds,
	NameReplacements,
	PreparedOptions,
	ShorthandConfiguration as ShorthandConfig,
	ShorthandMatcher,
	ShorthandReplacement,
} from "./types";

const SPECIAL_CHARACTER_REGEX = /[.+^${}()|[\]\\]/gu;
const REGEX_PATTERN_MATCHER = /^\/(?<first>.+)\/(?<second>[dgimsuvy]*)$/u;

interface ReplacementNames {
	readonly lowerFirst: ReadonlyArray<string>;
	readonly upperFirst: ReadonlyArray<string>;
}

const replacementNamesByConfiguration = new WeakMap<Map<string, boolean>, ReplacementNames>();
const preparedOptionsByConfiguration = new WeakMap<object, PreparedOptions>();

function isUpperCase(value: string): boolean {
	return value === value.toUpperCase();
}

export function isUpperFirst(value: string): boolean {
	return isUpperCase(value.charAt(0));
}

function upperFirst(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function lowerFirst(value: string): string {
	return value.charAt(0).toLowerCase() + value.slice(1);
}

function ensureUnicodeFlag(flags: string): string {
	return flags.includes("u") || flags.includes("v") ? flags : `${flags}u`;
}

const CHARACTER_TYPE_LOWERCASE = 0;
const CHARACTER_TYPE_UPPERCASE = 1;
const CHARACTER_TYPE_DIGIT = 2;
const CHARACTER_TYPE_OTHER = 3;

function getCharacterType(characterCode: number | undefined): number {
	if (characterCode === undefined) return CHARACTER_TYPE_OTHER;
	if (characterCode >= 97 && characterCode <= 122) return CHARACTER_TYPE_LOWERCASE;
	if (characterCode >= 65 && characterCode <= 90) return CHARACTER_TYPE_UPPERCASE;
	if (characterCode >= 48 && characterCode <= 57) return CHARACTER_TYPE_DIGIT;
	return CHARACTER_TYPE_OTHER;
}

function shouldSplitIdentifier(previousType: number, currentType: number, nextType: number): boolean {
	if (previousType === CHARACTER_TYPE_OTHER || currentType === CHARACTER_TYPE_OTHER) {
		return previousType !== currentType;
	}
	if (previousType === CHARACTER_TYPE_DIGIT || currentType === CHARACTER_TYPE_DIGIT) {
		return previousType !== currentType;
	}
	return (
		(previousType === CHARACTER_TYPE_LOWERCASE && currentType === CHARACTER_TYPE_UPPERCASE) ||
		(previousType === CHARACTER_TYPE_UPPERCASE &&
			currentType === CHARACTER_TYPE_UPPERCASE &&
			nextType === CHARACTER_TYPE_LOWERCASE)
	);
}

function splitIdentifierIntoWords(identifier: string): ReadonlyArray<string> {
	if (identifier.length < 2) return [identifier];

	const words = new Array<string>();
	let wordStart = 0;
	let previousType = getCharacterType(identifier.codePointAt(0));

	for (let index = 1; index < identifier.length; index += 1) {
		const currentType = getCharacterType(identifier.codePointAt(index));
		const nextType = getCharacterType(identifier.codePointAt(index + 1));
		if (shouldSplitIdentifier(previousType, currentType, nextType)) {
			words.push(identifier.slice(wordStart, index));
			wordStart = index;
		}
		previousType = currentType;
	}

	words.push(identifier.slice(wordStart));
	return words;
}

const DOLLAR_NUMBER_REGEX = /\$\d+/gu;

function countCaptureGroups(replacement: string): number {
	const dollarReferences = replacement.match(DOLLAR_NUMBER_REGEX);
	if (dollarReferences === null) return 0;

	let maxGroup = 0;
	for (const dollarReference of dollarReferences) {
		const groupNumber = Math.trunc(Number(dollarReference.slice(1)));
		if (groupNumber > maxGroup) maxGroup = groupNumber;
	}

	return maxGroup;
}

function buildReplacementPatterns(replacement: string): ReadonlyArray<RegExp> {
	const count = countCaptureGroups(replacement);
	if (count === 0) return [];

	const patterns = Array.from<RegExp>({ length: count });
	for (let index = 1; index <= count; index += 1) {
		patterns[index - 1] = new RegExp(`\\$${index}`, "gu");
	}
	return patterns;
}

function buildReplacementNames(replacement: ReadonlyMap<string, boolean>): ReplacementNames {
	const lowerFirstReplacements = new Array<string>();
	const upperFirstReplacements = new Array<string>();
	let size = 0;

	for (const [name, enabled] of replacement) {
		if (!enabled) continue;
		lowerFirstReplacements[size] = lowerFirst(name);
		upperFirstReplacements[size] = upperFirst(name);
		size += 1;
	}

	return {
		lowerFirst: lowerFirstReplacements.toSorted((left, right) => left.localeCompare(right)),
		upperFirst: upperFirstReplacements.toSorted((left, right) => left.localeCompare(right)),
	};
}

type MatcherResult =
	| { matcher: ShorthandMatcher; type: "pattern" }
	| { original: string; replacement: string; type: "exact" };

function createMatcher(key: string, replacement: string): MatcherResult {
	if (key.startsWith("/")) {
		const match = REGEX_PATTERN_MATCHER.exec(key);
		if (match?.groups !== undefined) {
			return {
				matcher: {
					original: key,
					/* v8 ignore next -- regexp matcher parsing always supplies the optional flags capture. @preserve */
					pattern: new RegExp(`^${match.groups.first}$`, ensureUnicodeFlag(match.groups.second ?? "")),
					replacement,
					replacementPatterns: buildReplacementPatterns(replacement),
				},
				type: "pattern",
			};
		}
	}

	if (key.includes("*") || key.includes("?")) {
		const regexPattern = key
			.replaceAll(SPECIAL_CHARACTER_REGEX, String.raw`\$&`)
			.replaceAll("*", "(.*)")
			.replaceAll("?", "(.)");

		let captureIndex = 0;
		const regexReplacement = replacement.replaceAll("*", () => `$${++captureIndex}`);

		return {
			matcher: {
				original: key,
				pattern: new RegExp(`^${regexPattern}$`, "u"),
				replacement: regexReplacement,
				replacementPatterns: buildReplacementPatterns(regexReplacement),
			},
			type: "pattern",
		};
	}

	return { original: key, replacement, type: "exact" };
}

function matchWord(word: string, configuration: ShorthandConfig): ShorthandReplacement["matches"][number] | undefined {
	const exactReplacement = configuration.exactMatchers.get(word);
	if (exactReplacement !== undefined) {
		return {
			matchedWord: word,
			replacement: exactReplacement,
			shorthand: word,
		};
	}

	for (const matcher of configuration.matchers) {
		const match = word.match(matcher.pattern);
		if (match === null) continue;

		let replaced = matcher.replacement;
		let captureIndex = 1;
		for (const replacementPattern of matcher.replacementPatterns) {
			replaced = replaced.replaceAll(replacementPattern, match[captureIndex] ?? "");
			captureIndex += 1;
		}

		return {
			matchedWord: word,
			replacement: replaced,
			shorthand: matcher.original,
		};
	}

	return undefined;
}

function isWordIgnored(word: string, configuration: ShorthandConfig): boolean {
	if (configuration.ignoreExact.has(word)) return true;

	for (const matcher of configuration.ignoreMatchers) {
		if (matcher.pattern.test(word)) return true;
	}

	return false;
}

function normalizeImportCheckOption(value: unknown, defaultValue: ImportCheckOption): ImportCheckOption {
	if (value === "internal" || typeof value === "boolean") return value;
	return defaultValue;
}

function normalizeBooleanRecord(value: unknown): Record<string, boolean> | undefined {
	if (!isRecord(value)) return undefined;

	const normalizedValue: Record<string, boolean> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry === "boolean") normalizedValue[key] = entry;
	}

	return normalizedValue;
}

function normalizeBooleanOption(value: unknown, defaultValue: boolean): boolean {
	return typeof value === "boolean" ? value : defaultValue;
}

function normalizeAllowList(options: unknown): Map<string, boolean> {
	const normalizedOptions = isRecord(options) ? options : undefined;
	const configuredAllowList = normalizeBooleanRecord(normalizedOptions?.allowList);
	const extendDefaultAllowList = normalizeBooleanOption(normalizedOptions?.extendDefaultAllowList, true);
	const mergedAllowList = evilTernary(
		extendDefaultAllowList,
		configuredAllowList === undefined ? DEFAULT_ALLOW_LIST : { ...DEFAULT_ALLOW_LIST, ...configuredAllowList },
		configuredAllowList ?? {},
	);

	return new Map(Object.entries(mergedAllowList));
}

function normalizeReplacementOverrides(value: unknown): Record<string, false | Record<string, boolean>> {
	if (!isRecord(value)) return {};

	const overrides: Record<string, false | Record<string, boolean>> = {};
	for (const [name, override] of Object.entries(value)) {
		if (override === false) {
			overrides[name] = false;
			continue;
		}

		if (!isRecord(override)) continue;

		const normalizedOverride: Record<string, boolean> = {};
		for (const [replacementName, enabled] of Object.entries(override)) {
			if (typeof enabled === "boolean") normalizedOverride[replacementName] = enabled;
		}
		overrides[name] = normalizedOverride;
	}

	return overrides;
}

function normalizeReplacements(options: unknown): Map<string, Map<string, boolean>> {
	const normalizedOptions = isRecord(options) ? options : undefined;
	const extendDefaultReplacements = normalizeBooleanOption(normalizedOptions?.extendDefaultReplacements, true);
	const configuredReplacements = normalizeReplacementOverrides(normalizedOptions?.replacements);
	const replacementKeys = new Set<string>([
		...Object.keys(DEFAULT_REPLACEMENTS),
		...Object.keys(configuredReplacements),
	]);

	const mergedReplacements = new Array<[string, Map<string, boolean>]>();

	for (const discouragedName of replacementKeys) {
		const configuredOverride = configuredReplacements[discouragedName];
		const baseReplacements = extendDefaultReplacements ? (DEFAULT_REPLACEMENTS[discouragedName] ?? {}) : {};
		const mergedForName =
			configuredOverride === false
				? {}
				: evilTernary(configuredOverride === undefined, baseReplacements, {
						...baseReplacements,
						...configuredOverride,
					});
		const replacement = new Map(Object.entries(mergedForName));
		replacementNamesByConfiguration.set(replacement, buildReplacementNames(replacement));
		mergedReplacements.push([discouragedName, replacement]);
	}

	return new Map(mergedReplacements);
}

function normalizeIgnorePatterns(options: unknown): ReadonlyArray<RegExp> {
	const normalizedOptions = isRecord(options) ? options : undefined;
	const ignorePatterns = new Array<RegExp | string>();

	for (const pattern of DEFAULT_IGNORE) ignorePatterns.push(pattern);

	if (Array.isArray(normalizedOptions?.ignore)) {
		for (const pattern of normalizedOptions.ignore) {
			if (isStringRaw(pattern) || pattern instanceof RegExp) ignorePatterns.push(pattern);
		}
	}

	return ignorePatterns.map((pattern) => (pattern instanceof RegExp ? pattern : new RegExp(pattern, "u")));
}

function normalizeAllowPropertyAccess(options: unknown): ReadonlySet<string> {
	const normalizedOptions = isRecord(options) ? options : undefined;
	const allowPropertyAccess = new Set<string>(DEFAULT_ALLOW_PROPERTY_ACCESS);
	if (!isStringArray(normalizedOptions?.allowPropertyAccess)) return allowPropertyAccess;

	for (const name of normalizedOptions.allowPropertyAccess) allowPropertyAccess.add(name);
	return allowPropertyAccess;
}

function normalizeShorthandConfiguration(options: unknown): ShorthandConfig {
	const normalizedOptions = isRecord(options) ? options : undefined;
	const exactMatchers = new Map<string, string>();
	const ignoreExact = new Set<string>();
	const ignoreMatchers = new Array<ShorthandMatcher>();
	const matchers = new Array<ShorthandMatcher>();
	const configuredShorthands = isStringRecord(normalizedOptions?.shorthands) ? normalizedOptions.shorthands : {};
	const mergedShorthands = { ...DEFAULT_SHORTHANDS, ...configuredShorthands };

	for (const [key, value] of Object.entries(mergedShorthands)) {
		const result = createMatcher(key, value);
		if (result.type === "exact") exactMatchers.set(result.original, result.replacement);
		else matchers.push(result.matcher);
	}

	if (isStringArray(normalizedOptions?.ignoreShorthands)) {
		for (const pattern of normalizedOptions.ignoreShorthands) {
			const result = createMatcher(pattern, "");
			if (result.type === "exact") ignoreExact.add(result.original);
			else ignoreMatchers.push(result.matcher);
		}
	}

	return {
		exactMatchers,
		ignoredIdentifiers: new Map<string, boolean>(),
		ignoreExact,
		ignoreMatchers,
		matchers,
		replacementsByIdentifier: new Map<string, false | ShorthandReplacement>(),
	};
}

function createPreparedOptions(options: unknown): PreparedOptions {
	const normalizedOptions = isRecord(options) ? options : undefined;
	return {
		allowList: normalizeAllowList(normalizedOptions),
		allowPropertyAccess: normalizeAllowPropertyAccess(normalizedOptions),
		checkDefaultAndNamespaceImports: normalizeImportCheckOption(
			normalizedOptions?.checkDefaultAndNamespaceImports,
			"internal",
		),
		checkFilenames: normalizeBooleanOption(normalizedOptions?.checkFilenames, true),
		checkProperties: normalizeBooleanOption(normalizedOptions?.checkProperties, false),
		checkShorthandImports: normalizeImportCheckOption(normalizedOptions?.checkShorthandImports, "internal"),
		checkShorthandProperties: normalizeBooleanOption(normalizedOptions?.checkShorthandProperties, true),
		checkVariables: normalizeBooleanOption(normalizedOptions?.checkVariables, true),
		ignore: normalizeIgnorePatterns(normalizedOptions),
		nameReplacements: new Map<string, NameReplacements>(),
		replacements: normalizeReplacements(normalizedOptions),
		shorthandConfiguration: normalizeShorthandConfiguration(normalizedOptions),
	};
}

function clonePreparedOptions(options: PreparedOptions): PreparedOptions {
	return {
		...options,
		nameReplacements: new Map<string, NameReplacements>(),
		shorthandConfiguration: {
			...options.shorthandConfiguration,
			ignoredIdentifiers: new Map<string, boolean>(),
			replacementsByIdentifier: new Map<string, false | ShorthandReplacement>(),
		},
	};
}

export function prepareOptions(options: unknown): PreparedOptions {
	if (!isRecord(options)) return createPreparedOptions(options);

	const cachedOptions = preparedOptionsByConfiguration.get(options);
	if (cachedOptions !== undefined) return clonePreparedOptions(cachedOptions);

	const preparedOptions = createPreparedOptions(options);
	preparedOptionsByConfiguration.set(options, preparedOptions);
	return clonePreparedOptions(preparedOptions);
}

function getWordReplacements(word: string, options: PreparedOptions): ReadonlyArray<string> {
	if (isUpperCase(word) || options.allowList.get(word) === true) return [];

	const replacement =
		options.replacements.get(lowerFirst(word)) ??
		options.replacements.get(word) ??
		options.replacements.get(upperFirst(word));

	if (replacement === undefined) return [];

	const replacementNames = replacementNamesByConfiguration.get(replacement);
	/* v8 ignore next -- normalized replacement maps are registered in replacementNamesByConfiguration. @preserve */
	if (replacementNames === undefined) return [];

	return isUpperFirst(word) ? replacementNames.upperFirst : replacementNames.lowerFirst;
}

export function getShorthandReplacement(
	identifier: string,
	configuration: ShorthandConfig,
): ShorthandReplacement | undefined {
	const cachedReplacement = configuration.replacementsByIdentifier.get(identifier);
	if (cachedReplacement !== undefined) return cachedReplacement === false ? undefined : cachedReplacement;
	if (identifier.length === 0) return undefined;

	const words = splitIdentifierIntoWords(identifier);
	const matches = new Array<ShorthandReplacement["matches"][number]>();

	for (const word of words) {
		const match = matchWord(word, configuration);
		if (match !== undefined) matches.push(match);
	}

	if (matches.length === 0) {
		configuration.replacementsByIdentifier.set(identifier, false);
		return undefined;
	}

	let replaced = "";
	let matchIndex = 0;
	for (const word of words) {
		const currentMatch = matches[matchIndex];
		if (currentMatch?.matchedWord === word) {
			replaced += currentMatch.replacement;
			matchIndex += 1;
			continue;
		}

		replaced += word;
	}

	const replacement = { matches, replaced };
	configuration.replacementsByIdentifier.set(identifier, replacement);
	return replacement;
}

export function isShorthandIgnored(identifier: string, configuration: ShorthandConfig): boolean {
	const cachedIgnored = configuration.ignoredIdentifiers.get(identifier);
	if (cachedIgnored !== undefined) return cachedIgnored;

	let ignored = isWordIgnored(identifier, configuration);
	if (!ignored) {
		const replacement = getShorthandReplacement(identifier, configuration);
		ignored =
			replacement !== undefined &&
			replacement.matches.length > 0 &&
			replacement.matches.every((match) => isWordIgnored(match.matchedWord, configuration));
	}

	configuration.ignoredIdentifiers.set(identifier, ignored);
	return ignored;
}

export function isPropertyAccessAllowed(
	identifier: string,
	replacement: ShorthandReplacement,
	allowPropertyAccess: ReadonlySet<string>,
): boolean {
	if (allowPropertyAccess.has(identifier)) return true;

	for (const match of replacement.matches) {
		if (!allowPropertyAccess.has(match.matchedWord)) return false;
	}

	return replacement.matches.length > 0;
}

export function getNameReplacements(name: string, options: PreparedOptions, limit = 3): NameReplacements {
	const cacheKey = `${limit}\0${name}`;
	const cachedReplacements = options.nameReplacements.get(cacheKey);
	if (cachedReplacements !== undefined) return cachedReplacements;

	const replacements = computeNameReplacements(name, options, limit);
	options.nameReplacements.set(cacheKey, replacements);
	return replacements;
}

function computeNameReplacements(name: string, options: PreparedOptions, limit: number): NameReplacements {
	if (options.allowList.get(name) === true || options.ignore.some((pattern) => pattern.test(name))) {
		return { total: 0 };
	}

	const shorthandReplacement = getShorthandReplacement(name, options.shorthandConfiguration);
	if (shorthandReplacement !== undefined) {
		if (isShorthandIgnored(name, options.shorthandConfiguration)) return { total: 0 };
		return {
			samples: [shorthandReplacement.replaced],
			total: 1,
		};
	}

	if (isUpperCase(name)) return { total: 0 };

	const exactReplacements = getWordReplacements(name, options);
	if (exactReplacements.length > 0) {
		return {
			samples: exactReplacements.slice(0, limit),
			total: exactReplacements.length,
		};
	}

	const words = name.split(WORD_SPLIT_PATTERN).filter(Boolean);
	let hasReplacements = false;
	const combinations = new Array<ReadonlyArray<string>>();
	let size = 0;

	for (const word of words) {
		const wordReplacements = getWordReplacements(word, options);
		if (wordReplacements.length > 0) {
			hasReplacements = true;
			combinations[size++] = wordReplacements;
			continue;
		}

		combinations[size++] = [word];
	}

	if (!hasReplacements) return { total: 0 };

	const total = combinations.reduce((count, entries) => count * entries.length, 1);
	const samples = getReplacementSamples(combinations, total, limit);

	return {
		samples: samples.map((parts) => parts.join("")),
		total,
	};
}

function getReplacementSamples(
	combinations: ReadonlyArray<ReadonlyArray<string>>,
	total: number,
	limit: number,
): Array<Array<string>> {
	const sampleCount = Math.min(total, limit);
	const samples = Array.from({ length: sampleCount }, (_, sampleIndex) => {
		let indexRemaining = sampleIndex;
		const combination = new Array<string>();
		for (let combinationIndex = combinations.length - 1; combinationIndex >= 0; combinationIndex -= 1) {
			/* v8 ignore next -- combinationIndex is bounded by combinations.length. @preserve */
			const entries = combinations[combinationIndex] ?? [];
			const index = indexRemaining % entries.length;
			indexRemaining = (indexRemaining - index) / entries.length;
			const entry = entries[index];
			/* v8 ignore next -- sample indexes are generated modulo the entry list length. @preserve */
			if (entry !== undefined) combination.unshift(entry);
		}
		return combination;
	});

	for (const parts of samples) {
		for (let index = parts.length - 1; index > 0; index -= 1) {
			/* v8 ignore next -- index is bounded by the current sample part length. @preserve */
			const word = parts[index] ?? "";
			if (IS_ALPHABETIC.test(word) && parts[index - 1]?.endsWith(word) === true) parts.splice(index, 1);
		}
	}

	return samples;
}

export function isDiscouragedReplacementName(name: string, options: PreparedOptions): boolean {
	const replacement = options.replacements.get(name);
	if (replacement === undefined) return false;

	const replacementNames = replacementNamesByConfiguration.get(replacement);
	return replacementNames !== undefined && replacementNames.lowerFirst.length > 0;
}

export function getMessage(
	discouragedName: string,
	{ samples = [], total }: NameReplacements,
	nameTypeText: string,
): { data: Record<string, string>; messageId: MessageIds } {
	if (total === 1) {
		return {
			data: {
				discouragedName,
				nameTypeText,
				replacement: samples[0] ?? "",
			},
			messageId: MESSAGE_ID_REPLACE,
		};
	}

	let replacementsText = samples.map((replacement) => `\`${replacement}\``).join(", ");
	const omittedReplacementsCount = total - samples.length;
	if (omittedReplacementsCount > 0) {
		replacementsText += `, ... (${omittedReplacementsCount > 99 ? "99+" : omittedReplacementsCount} more omitted)`;
	}

	return {
		data: {
			discouragedName,
			nameTypeText,
			replacementsText,
		},
		messageId: MESSAGE_ID_SUGGESTION,
	};
}
