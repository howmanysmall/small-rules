// oxlint-disable unicorn/prefer-code-point -- Performance

const SPLIT_LOWER_TO_UPPER = /(?<first>[\p{Ll}\d])(?<second>\p{Lu})/gu;
const SPLIT_UPPER_TO_UPPER = /(?<first>\p{Lu})(?<second>\p{Lu}\p{Ll})/gu;
const SPLIT_REPLACE_VALUE = "$<first>\0$<second>";

export function toPascalCase(value: string): string {
	const trimmed = value.trim();
	if (trimmed.length === 0) return "";

	const marked = trimmed
		.replace(SPLIT_LOWER_TO_UPPER, SPLIT_REPLACE_VALUE)
		.replace(SPLIT_UPPER_TO_UPPER, SPLIT_REPLACE_VALUE);

	let start = 0;
	let { length } = marked;

	while (marked.charCodeAt(start) === 0) start += 1;
	if (start === length) return "";

	while (marked.charCodeAt(length - 1) === 0) length -= 1;

	let result = "";
	let wordStart = start;
	let previousWordLength = 0;

	for (let index = start; index <= length; index += 1) {
		if (index !== length && marked.charCodeAt(index) !== 0) continue;
		if (index > wordStart) {
			const word = marked.slice(wordStart, index);
			// A one-letter word followed by one that does not go on with a letter
			// reads back as a single acronym, so join them as one.
			const joinsAcronym = previousWordLength === 1 && !startsWithDigit(word) && !hasLetterAt(word, 1);
			result += formatWord(word, result.length > 0, joinsAcronym);
			previousWordLength = joinsAcronym ? previousWordLength + word.length : word.length;
		}
		wordStart = index + 1;
	}

	return result;
}

function hasLetterAt(word: string, index: number): boolean {
	const character = word.charAt(index);
	return character.toLowerCase() !== character.toUpperCase();
}

function startsWithDigit(word: string): boolean {
	const firstByte = word.charCodeAt(0);
	return firstByte >= 48 && firstByte <= 57;
}

function formatWord(word: string, hasPreviousWord: boolean, joinsAcronym: boolean): string {
	if (joinsAcronym) return word.toLowerCase();
	const separator = hasPreviousWord && startsWithDigit(word) ? "_" : "";
	return separator + word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
