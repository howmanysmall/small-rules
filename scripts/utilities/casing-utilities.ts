// oxlint-disable unicorn/prefer-code-point sonar/cognitive-complexity -- This file intentionally uses UTF-16 ASCII primitives in hot paths.
// biome-ignore-all lint/complexity/useMaxParams: cattle

export const enum Casing {
	CamelCase = "camel-case",
	ConstantCase = "constant-case",
	DotCase = "dot-case",
	KebabCase = "kebab-case",
	LowerCase = "lowercase",
	PascalCase = "pascal-case",
	PathCase = "path-case",
	SnakeCase = "snake-case",
	TitleCase = "title-case",
	Unknown = "unknown",
	UpperCase = "uppercase",
}

function toUpperCaseSlow(value: string): string {
	return value.toLocaleUpperCase();
}
function toLowerCaseSlow(value: string): string {
	return value.toLocaleLowerCase();
}
function toUpperCaseFast(value: string): string {
	return value.toUpperCase();
}
function toLowerCaseFast(value: string): string {
	return value.toLowerCase();
}

let toUpperCaseLocale: (value: string) => string = toUpperCaseFast;
let toLowerCaseLocale: (value: string) => string = toLowerCaseFast;
let localeModeEnabled = false;

export function setLocaleMode(enabled: boolean): void {
	localeModeEnabled = enabled;
	if (enabled) {
		toUpperCaseLocale = toUpperCaseSlow;
		toLowerCaseLocale = toLowerCaseSlow;
	} else {
		toUpperCaseLocale = toUpperCaseFast;
		toLowerCaseLocale = toLowerCaseFast;
	}
}

const enum TransformMode {
	Camel = 0,
	DelimitedLower = 1,
	DelimitedUpper = 2,
	Lower = 3,
	Pascal = 4,
	Space = 5,
	Title = 6,
	Upper = 7,
}

type MatchingTransformMode =
	| TransformMode.Camel
	| TransformMode.DelimitedLower
	| TransformMode.DelimitedUpper
	| TransformMode.Lower
	| TransformMode.Pascal
	| TransformMode.Title
	| TransformMode.Upper;

const ASCII_CASE_OFFSET = 32;
const CARRIAGE_RETURN = 13;
const DOT = 46;
const HYPHEN = 45;
const LINE_FEED = 10;
const SLASH = 47;
const SPACE = 32;
const TAB = 9;
const UNDERSCORE = 95;
const UPPERCASE_A = 65;
const UPPERCASE_Z = 90;
const LOWERCASE_A = 97;
const LOWERCASE_Z = 122;

function isAsciiLowerCode(code: number): boolean {
	return code >= LOWERCASE_A && code <= LOWERCASE_Z;
}

function isAsciiUpperCode(code: number): boolean {
	return code >= UPPERCASE_A && code <= UPPERCASE_Z;
}

function isAsciiLetterCode(code: number): boolean {
	return isAsciiLowerCode(code) || isAsciiUpperCode(code);
}

function isSeparatorCode(code: number): boolean {
	return code === DOT || code === SLASH || code === UNDERSCORE || code === HYPHEN;
}

function isWhitespaceCode(code: number): boolean {
	return code === SPACE || (code >= TAB && code <= CARRIAGE_RETURN);
}

function lowerAsciiCharacter(value: string, code: number): string {
	if (isAsciiUpperCode(code)) return String.fromCharCode(code + ASCII_CASE_OFFSET);
	return localeModeEnabled || code > 127 ? toLowerCaseLocale(value) : value;
}

function upperAsciiCharacter(value: string, code: number): string {
	if (isAsciiLowerCode(code)) return String.fromCharCode(code - ASCII_CASE_OFFSET);
	return localeModeEnabled || code > 127 ? toUpperCaseLocale(value) : value;
}

function appendTransformedCharacter(
	result: string,
	value: string,
	code: number,
	mode: TransformMode,
	capitalizeNext: boolean,
): string {
	switch (mode) {
		case TransformMode.Camel:
		case TransformMode.Pascal: {
			if (capitalizeNext && isAsciiLetterCode(code)) return result + upperAsciiCharacter(value, code);
			return result + lowerAsciiCharacter(value, code);
		}

		case TransformMode.DelimitedLower:
		case TransformMode.Lower:
			return result + lowerAsciiCharacter(value, code);

		case TransformMode.DelimitedUpper:
		case TransformMode.Upper:
			return result + upperAsciiCharacter(value, code);

		case TransformMode.Title: {
			return capitalizeNext && isAsciiLowerCode(code)
				? result + upperAsciiCharacter(value, code)
				: result + value;
		}

		default:
			return result + value;
	}
}

function matchesStringAt(value: string, index: number, expected: string): number {
	if (expected.length === 1) {
		return value.charCodeAt(index) === expected.charCodeAt(0) ? index + 1 : -1;
	}
	return value.startsWith(expected, index) ? index + expected.length : -1;
}

function matchLowerCharacter(value: string, sourceIndex: number, code: number, outputIndex: number): number {
	if (isAsciiUpperCode(code)) {
		return -1;
	}

	const sourceCharacter = value.charAt(sourceIndex);
	if (localeModeEnabled || code > 127) return matchesStringAt(value, outputIndex, toLowerCaseLocale(sourceCharacter));
	return value.charCodeAt(outputIndex) === code ? outputIndex + 1 : -1;
}

function matchUpperCharacter(value: string, sourceIndex: number, code: number, outputIndex: number): number {
	if (isAsciiLowerCode(code)) {
		return -1;
	}

	const sourceCharacter = value.charAt(sourceIndex);
	if (localeModeEnabled || code > 127) return matchesStringAt(value, outputIndex, toUpperCaseLocale(sourceCharacter));
	return value.charCodeAt(outputIndex) === code ? outputIndex + 1 : -1;
}

function matchTransformedCharacter(
	value: string,
	sourceIndex: number,
	code: number,
	mode: MatchingTransformMode,
	capitalizeNext: boolean,
	outputIndex: number,
): number {
	if (mode === TransformMode.Camel || mode === TransformMode.Pascal) {
		if (capitalizeNext && isAsciiLetterCode(code)) {
			return matchUpperCharacter(value, sourceIndex, code, outputIndex);
		}
		return matchLowerCharacter(value, sourceIndex, code, outputIndex);
	}

	if (mode === TransformMode.DelimitedLower || mode === TransformMode.Lower) {
		return matchLowerCharacter(value, sourceIndex, code, outputIndex);
	}

	if (mode === TransformMode.DelimitedUpper || mode === TransformMode.Upper) {
		return matchUpperCharacter(value, sourceIndex, code, outputIndex);
	}

	if (capitalizeNext && isAsciiLowerCode(code)) {
		return matchUpperCharacter(value, sourceIndex, code, outputIndex);
	}
	return value.charCodeAt(outputIndex) === code ? outputIndex + 1 : -1;
}

function modeEmitsDelimiter(mode: TransformMode): boolean {
	return (
		mode === TransformMode.DelimitedLower ||
		mode === TransformMode.DelimitedUpper ||
		mode === TransformMode.Lower ||
		mode === TransformMode.Space ||
		mode === TransformMode.Title ||
		mode === TransformMode.Upper
	);
}

function hasCamelCaseBoundary(previousCode: number, code: number, nextCode: number): boolean {
	return (
		isAsciiUpperCode(code) &&
		(isAsciiLowerCode(previousCode) || (isAsciiUpperCode(previousCode) && isAsciiLowerCode(nextCode)))
	);
}

function getLineBreakLength(value: string, index: number, code: number): number {
	if (code === LINE_FEED) return 1;
	if (code !== CARRIAGE_RETURN) return 0;
	return value.charCodeAt(index + 1) === LINE_FEED ? 2 : 1;
}

function transformCasing(value: string, mode: TransformMode, delimiter: string): string {
	let result = "";
	let hasLineOutput = false;
	let pendingDelimiter = false;
	let capitalizeNext = mode === TransformMode.Pascal || mode === TransformMode.Title;
	let previousCode = 0;

	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);

		const lineBreakLength = getLineBreakLength(value, index, code);
		if (lineBreakLength > 0) {
			if (lineBreakLength === 2) {
				result += "\r\n";
				index += 1;
			} else result += value[index];

			hasLineOutput = false;
			pendingDelimiter = false;
			capitalizeNext = mode === TransformMode.Pascal || mode === TransformMode.Title;
			previousCode = 0;
			continue;
		}

		if (isSeparatorCode(code) || isWhitespaceCode(code)) {
			if (hasLineOutput) pendingDelimiter = true;
			previousCode = SPACE;
			continue;
		}

		const valueAtIndex = value.charAt(index);

		const hasCamelBoundary =
			hasLineOutput && !pendingDelimiter && hasCamelCaseBoundary(previousCode, code, value.charCodeAt(index + 1));

		if (hasLineOutput && (pendingDelimiter || hasCamelBoundary)) {
			if (modeEmitsDelimiter(mode)) result += delimiter;
			capitalizeNext = true;
		}

		result = appendTransformedCharacter(result, valueAtIndex, code, mode, capitalizeNext);
		hasLineOutput = true;
		pendingDelimiter = false;
		capitalizeNext = false;
		previousCode = code;
	}

	return result;
}

function matchesCasing(value: string, mode: MatchingTransformMode, delimiter: string): boolean {
	let outputIndex = 0;
	let hasLineOutput = false;
	let pendingDelimiter = false;
	let capitalizeNext = mode === TransformMode.Pascal || mode === TransformMode.Title;
	let previousCode = 0;

	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);

		const lineBreakLength = getLineBreakLength(value, index, code);
		if (lineBreakLength > 0) {
			if (lineBreakLength === 2) {
				outputIndex = matchesStringAt(value, outputIndex, "\r\n");
				index += 1;
			} else {
				outputIndex = value.charCodeAt(outputIndex) === code ? outputIndex + 1 : -1;
			}
			if (outputIndex === -1) return false;

			hasLineOutput = false;
			pendingDelimiter = false;
			capitalizeNext = mode === TransformMode.Pascal || mode === TransformMode.Title;
			previousCode = 0;
			continue;
		}

		if (isSeparatorCode(code) || isWhitespaceCode(code)) {
			if (hasLineOutput) pendingDelimiter = true;
			previousCode = SPACE;
			continue;
		}

		const hasCamelBoundary =
			hasLineOutput && !pendingDelimiter && hasCamelCaseBoundary(previousCode, code, value.charCodeAt(index + 1));

		if (hasLineOutput && (pendingDelimiter || hasCamelBoundary)) {
			if (modeEmitsDelimiter(mode)) {
				outputIndex = matchesStringAt(value, outputIndex, delimiter);
				if (outputIndex === -1) return false;
			}
			capitalizeNext = true;
		}

		outputIndex = matchTransformedCharacter(value, index, code, mode, capitalizeNext, outputIndex);
		if (outputIndex === -1) return false;

		hasLineOutput = true;
		pendingDelimiter = false;
		capitalizeNext = false;
		previousCode = code;
	}

	return outputIndex === value.length;
}

export function toSpaceCase(value: string): string {
	return transformCasing(value, TransformMode.Space, " ");
}
export function toLowerCase(value: string): string {
	return transformCasing(value, TransformMode.Lower, " ");
}
export function toUpperCase(value: string): string {
	return transformCasing(value, TransformMode.Upper, " ");
}
export function toPathCase(value: string): string {
	return transformCasing(value, TransformMode.DelimitedLower, "/");
}

export function toTitleCase(value: string): string {
	return transformCasing(value, TransformMode.Title, " ");
}

export function toPascalCase(value: string): string {
	return transformCasing(value, TransformMode.Pascal, "");
}

export function toCamelCase(value: string): string {
	return transformCasing(value, TransformMode.Camel, "");
}

export function toConstantCase(value: string): string {
	return transformCasing(value, TransformMode.DelimitedUpper, "_");
}

export function toSnakeCase(value: string): string {
	return transformCasing(value, TransformMode.DelimitedLower, "_");
}

export function toDotCase(value: string): string {
	return transformCasing(value, TransformMode.DelimitedLower, ".");
}

export function toKebabCase(value: string): string {
	return transformCasing(value, TransformMode.DelimitedLower, "-");
}

export function isCamelCase(value: string): boolean {
	return matchesCasing(value, TransformMode.Camel, "");
}
export function isConstantCase(value: string): boolean {
	return matchesCasing(value, TransformMode.DelimitedUpper, "_");
}
export function isDotCase(value: string): boolean {
	return matchesCasing(value, TransformMode.DelimitedLower, ".");
}
export function isKebabCase(value: string): boolean {
	return matchesCasing(value, TransformMode.DelimitedLower, "-");
}
export function isLowerCase(value: string): boolean {
	return matchesCasing(value, TransformMode.Lower, " ");
}
export function isPascalCase(value: string): boolean {
	return matchesCasing(value, TransformMode.Pascal, "");
}
export function isPathCase(value: string): boolean {
	return matchesCasing(value, TransformMode.DelimitedLower, "/");
}
export function isSnakeCase(value: string): boolean {
	return matchesCasing(value, TransformMode.DelimitedLower, "_");
}
export function isTitleCase(value: string): boolean {
	return matchesCasing(value, TransformMode.Title, " ");
}
export function isUnknown(_: string): boolean {
	return true;
}
export function isUpperCase(value: string): boolean {
	return matchesCasing(value, TransformMode.Upper, " ");
}

export function applyCasing(value: string, casing: Casing): string {
	switch (casing) {
		case Casing.CamelCase:
			return toCamelCase(value);

		case Casing.ConstantCase:
			return toConstantCase(value);

		case Casing.DotCase:
			return toDotCase(value);

		case Casing.KebabCase:
			return toKebabCase(value);

		case Casing.LowerCase:
			return toLowerCase(value);

		case Casing.PascalCase:
			return toPascalCase(value);

		case Casing.PathCase:
			return toPathCase(value);

		case Casing.SnakeCase:
			return toSnakeCase(value);

		case Casing.TitleCase:
			return toTitleCase(value);

		case Casing.UpperCase:
			return toUpperCase(value);

		default:
			return value;
	}
}

// oxlint-disable-next-line unicorn/no-hex-escape no-control-regex -- dumb rules.
const ASCII_ONLY_REGEXP = /^[\x00-\x7F]*$/v;
const graphemeSegmenter = new Intl.Segmenter(undefined, {
	granularity: "grapheme",
});

interface SegmentData {
	readonly segment: string;
}
function getSegment({ segment }: SegmentData): string {
	return segment;
}

function getCharacters(value: string): Array<string> {
	// oxlint-disable-next-line unicorn/prefer-spread -- not the same.
	if (ASCII_ONLY_REGEXP.test(value)) return value.split("");
	return Array.from(graphemeSegmenter.segment(value), getSegment);
}

function copyGraphemes(previousString: string, nextString: string): string {
	const previousCharacters = getCharacters(previousString);
	const nextCharacters = getCharacters(nextString);

	for (const [index, previousCharacter] of previousCharacters.entries()) {
		const nextCharacter = nextCharacters[index];
		if (nextCharacter === undefined) throw new TypeError("Unexpected undefined character");

		const toCase = isLowerCase(previousCharacter) ? toLowerCase : toUpperCase;
		nextCharacters[index] = toCase(nextCharacter);
	}

	return nextCharacters.join("");
}

export function copy(previousString: string, nextString: string): string {
	if (previousString.length === 0 || nextString.length === 0) return nextString;
	if (previousString.length !== nextString.length) return nextString;

	let result = "";
	for (let index = 0; index < previousString.length; index += 1) {
		const previousCode = previousString.charCodeAt(index);
		const nextCode = nextString.charCodeAt(index);
		if (previousCode > 127 || nextCode > 127) return copyGraphemes(previousString, nextString);

		const nextCharacter = nextString.charAt(index);

		result += isAsciiUpperCode(previousCode)
			? upperAsciiCharacter(nextCharacter, nextCode)
			: lowerAsciiCharacter(nextCharacter, nextCode);
	}

	return result;
}

const SPACE_REGEXP = /\s/u;
export function detect(value: string): Casing {
	if (value.length > 0) {
		if (SPACE_REGEXP.test(value)) {
			if (isTitleCase(value)) return Casing.TitleCase;
		} else {
			if (value.includes("-")) {
				if (isKebabCase(value)) return Casing.KebabCase;
			} else if (value.includes("_")) {
				if (isSnakeCase(value)) return Casing.SnakeCase;
				if (isConstantCase(value)) return Casing.ConstantCase;
			} else if (value.includes(".")) {
				if (isDotCase(value)) return Casing.DotCase;
			} else if (value.includes("/") && isPathCase(value)) return Casing.PathCase;

			const [first] = value;
			if (first !== undefined && isUpperCase(first)) {
				if (isUpperCase(value)) return Casing.UpperCase;
				if (isPascalCase(value)) return Casing.PascalCase;
			}

			if (isLowerCase(value)) return Casing.LowerCase;
			if (isCamelCase(value)) return Casing.CamelCase;
		}
	}

	return Casing.Unknown;
}
