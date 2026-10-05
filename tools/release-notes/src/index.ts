import { readdir } from "node:fs/promises";
import { isNonEmptyString } from "@small-rules/arktype-utilities";
import { type } from "arktype";
import { parse } from "smol-toml";

const RELEASE_FILE_REGEXP = /^(?<tag>v\d+\.\d+\.\d+(?:-[\w.]+)?)\.md$/u;
const TAG_REGEXP = /^v(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-(?<prerelease>.+))?$/u;
const TITLE_REGEXP = /^# (?<title>.+)$/mu;
const LINE_BREAK_REGEXP = /\r?\n/u;

const isCommuniqueConfiguration = type({
	"+": "ignore",
	defaults: {
		"+": "ignore",
		model: isNonEmptyString,
		repo: /^[\w.-]+\/[\w.-]+$/u,
	},
}).readonly();

export interface CommuniqueDefaults {
	readonly model: string;
	readonly owner: string;
	readonly repository: string;
}

export interface LineChanges {
	readonly added: number;
	readonly removed: number;
}

/**
 * Returns the release tag a file in `documentation/src/content/releases` holds
 * notes for, or `undefined` when the file is not a release note.
 *
 * @param fileName - The base name of the file.
 * @returns The tag, such as `v3.1.0`.
 */
export function getReleaseTag(fileName: string): string | undefined {
	return RELEASE_FILE_REGEXP.exec(fileName)?.groups?.tag;
}

function compareNumbers(left: number, right: number): number {
	return left - right;
}

/**
 * Sorts release tags by SemVer precedence, newest first. A prerelease sorts
 * after its stable release.
 *
 * @param left - The first tag.
 * @param right - The second tag.
 * @returns A negative number when `left` is newer.
 */
export function compareReleaseTagsDescending(left: string, right: string): number {
	const leftGroups = TAG_REGEXP.exec(left)?.groups;
	const rightGroups = TAG_REGEXP.exec(right)?.groups;
	if (leftGroups === undefined || rightGroups === undefined) return right.localeCompare(left);

	const byVersion =
		compareNumbers(Number(rightGroups.major), Number(leftGroups.major)) ||
		compareNumbers(Number(rightGroups.minor), Number(leftGroups.minor)) ||
		compareNumbers(Number(rightGroups.patch), Number(leftGroups.patch));
	if (byVersion !== 0) return byVersion;

	const leftPrerelease = leftGroups.prerelease;
	const rightPrerelease = rightGroups.prerelease;
	if (leftPrerelease === rightPrerelease) return 0;
	if (leftPrerelease === undefined) return -1;
	if (rightPrerelease === undefined) return 1;
	return rightPrerelease.localeCompare(leftPrerelease, undefined, { numeric: true });
}

/**
 * Lists the tags that have committed release notes, newest first.
 *
 * @param directory - Folder holding one `<tag>.md` file per release.
 * @returns Release tags such as `v3.1.0`, sorted by SemVer precedence.
 */
export async function listReleaseTagsAsync(directory: string): Promise<ReadonlyArray<string>> {
	const tags = new Array<string>();
	const fileNames = await readdir(directory);
	for (const fileName of fileNames) {
		const tag = getReleaseTag(fileName);
		if (tag !== undefined) tags.push(tag);
	}

	return tags.toSorted(compareReleaseTagsDescending);
}

/**
 * Reads the `[defaults]` model and repository from a `communique.toml`
 * document.
 *
 * @param source - The TOML source.
 * @returns The configured model and GitHub repository.
 */
export function readCommuniqueDefaults(source: string): CommuniqueDefaults {
	const configuration = isCommuniqueConfiguration(parse(source));
	if (configuration instanceof type.errors) throw new TypeError(`communique.toml: ${configuration.summary}`);

	const { model, repo } = configuration.defaults;
	const separator = repo.indexOf("/");
	return { model, owner: repo.slice(0, separator), repository: repo.slice(separator + 1) };
}

/**
 * Returns the text of the first level-one heading in a release note.
 *
 * @param markdown - The release note.
 * @returns The title, or `undefined` when there is none.
 */
export function getReleaseTitle(markdown: string): string | undefined {
	return TITLE_REGEXP.exec(markdown)?.groups?.title;
}

/**
 * Counts how many lines a regenerated release note adds and removes, treating
 * each document as a multiset of lines. It is a preview figure, not a diff.
 *
 * @param before - The current release note.
 * @param after - The regenerated release note.
 * @returns The added and removed line counts.
 */
export function countChangedLines(before: string, after: string): LineChanges {
	const remaining = new Map<string, number>();
	for (const line of before.split(LINE_BREAK_REGEXP)) remaining.set(line, (remaining.get(line) ?? 0) + 1);

	let added = 0;
	for (const line of after.split(LINE_BREAK_REGEXP)) {
		const count = remaining.get(line) ?? 0;
		if (count === 0) added += 1;
		else remaining.set(line, count - 1);
	}

	let removed = 0;
	for (const count of remaining.values()) removed += count;

	return { added, removed };
}
