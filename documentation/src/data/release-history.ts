import { regex } from "arktype";

import { ReleaseFilenameError } from "$classes/release-filename-error";

interface ReleaseVersion {
	readonly major: number;
	readonly minor: number;
	readonly patch: number;
	readonly tag: string;
}

interface ReleaseHistoryEntry {
	readonly body: string;
	readonly version: ReleaseVersion;
}

interface ReleaseHistoryEmptyState {
	readonly githubReleasesUrl: string;
	readonly message: string;
}

const releaseHistoryEmptyState: ReleaseHistoryEmptyState = {
	githubReleasesUrl: "https://github.com/howmanysmall/small-rules/releases",
	message: "No release notes have been published yet.",
};

interface EmptyReleaseHistory {
	readonly emptyState: ReleaseHistoryEmptyState;
	readonly entries: readonly [];
	readonly kind: "empty";
}

interface PopulatedReleaseHistory {
	readonly entries: ReadonlyArray<ReleaseHistoryEntry>;
	readonly kind: "populated";
}

export type ReleaseHistory = EmptyReleaseHistory | PopulatedReleaseHistory;

export interface ReleaseContentEntry {
	readonly id: string;
	readonly body: string;
}

interface CollectionReleaseEntry {
	readonly id: string;
	readonly body?: string | undefined;
	readonly filePath?: string | undefined;
}

// oxlint-disable-next-line unicorn/prefer-string-raw -- ArkType regex feature
const RELEASE_VERSION_REGEXP = regex("^v(?<major>0|[1-9]\\d*)\\.(?<minor>0|[1-9]\\d*)\\.(?<patch>0|[1-9]\\d*)$", "u");
const PATH_SEPARATOR_REGEXP = /[\\/]/u;

function parseReleaseVersion(id: string): ReleaseVersion {
	const match = RELEASE_VERSION_REGEXP.exec(id);
	const groups = match?.groups;
	if (groups === undefined) throw new ReleaseFilenameError(id);

	const { major, minor, patch } = groups;
	return { major: Number(major), minor: Number(minor), patch: Number(patch), tag: id };
}

function createReleaseHistoryEntry(entry: ReleaseContentEntry): ReleaseHistoryEntry {
	return { body: entry.body, version: parseReleaseVersion(entry.id) };
}

function getReleaseId(entry: CollectionReleaseEntry): string {
	if (entry.filePath === undefined) return entry.id;

	const filename = entry.filePath.split(PATH_SEPARATOR_REGEXP).at(-1);
	return filename?.endsWith(".md") === true ? filename.slice(0, -3) : entry.id;
}

export function getReleaseContentEntry(entry: CollectionReleaseEntry): ReleaseContentEntry {
	if (entry.body !== undefined) return { id: getReleaseId(entry), body: entry.body };
	throw new Error(`Release "${entry.id}" is missing its Markdown body.`);
}

function compareReleaseHistoryEntries(left: ReleaseHistoryEntry, right: ReleaseHistoryEntry): number {
	return (
		right.version.major - left.version.major ||
		right.version.minor - left.version.minor ||
		right.version.patch - left.version.patch
	);
}

export function createReleaseHistory(releaseEntries: ReadonlyArray<ReleaseContentEntry>): ReleaseHistory {
	const entries = releaseEntries.map(createReleaseHistoryEntry).toSorted(compareReleaseHistoryEntries);
	if (entries.length === 0) return { emptyState: releaseHistoryEmptyState, entries: [], kind: "empty" };

	return { entries, kind: "populated" };
}
