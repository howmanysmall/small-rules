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

export interface ReleaseHistoryEmptyState {
	readonly githubReleasesUrl: string;
	readonly message: string;
}

export const releaseHistoryEmptyState: ReleaseHistoryEmptyState = {
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
	readonly body: string;
	readonly id: string;
}

interface CollectionReleaseEntry {
	readonly body?: string;
	readonly filePath?: string;
	readonly id: string;
}

const releaseVersionPattern = /^v(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)$/u;
const pathSeparatorPattern = /[\\/]/u;

function createReleaseFilenameError(id: string): Error {
	const error = new Error(`Release filename "${id}" must use the v<major>.<minor>.<patch>.md format.`);
	Error.captureStackTrace(error, createReleaseFilenameError);
	return error;
}

function parseReleaseVersion(id: string): ReleaseVersion {
	const match = releaseVersionPattern.exec(id);
	const groups = match?.groups;
	if (groups === undefined) throw createReleaseFilenameError(id);

	const { major, minor, patch } = groups;
	if (major === undefined || minor === undefined || patch === undefined) {
		throw createReleaseFilenameError(id);
	}

	return { major: Number(major), minor: Number(minor), patch: Number(patch), tag: id };
}

function createReleaseHistoryEntry(entry: ReleaseContentEntry): ReleaseHistoryEntry {
	return { body: entry.body, version: parseReleaseVersion(entry.id) };
}

function getReleaseId(entry: CollectionReleaseEntry): string {
	if (entry.filePath === undefined) return entry.id;

	const filename = entry.filePath.split(pathSeparatorPattern).at(-1);
	return filename?.endsWith(".md") === true ? filename.slice(0, -3) : entry.id;
}

export function getReleaseContentEntry(entry: CollectionReleaseEntry): ReleaseContentEntry {
	if (entry.body !== undefined) return { body: entry.body, id: getReleaseId(entry) };

	const error = new Error(`Release "${entry.id}" is missing its Markdown body.`);
	Error.captureStackTrace(error, getReleaseContentEntry);
	throw error;
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
