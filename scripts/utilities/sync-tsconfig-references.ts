import { readdir, readFile, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import {
	isMaybeString,
	isNonEmptyString,
	isReadonlyDictionaryOfUnknowns,
	isUndefined,
} from "@small-rules/arktype-utilities";
import { isFileAccessibleAsync } from "@small-rules/fs-utilities";
import { type } from "arktype";

import type { DictionaryOfUnknowns } from "@small-rules/arktype-utilities";

// `tsgo --build` requires every referenced project to have `composite: true`
// and to emit declarations. Workspace packages here compile through the root
// `tsconfig.lib.json` instead, so only the solution `tsconfig.json` may
// declare references; any reference found in a package tsconfig is rejected
// by the compiler (TS6306) and removed on sync.

const TSCONFIG_JSON = "tsconfig.json";

/** Workspace directories whose children are projects in the solution graph. */
const PROJECT_PARENTS = ["packages"] as const;

/**
 * Workspace packages outside the project parents that `tsgo --build` covers.
 */
const STANDALONE_PROJECTS = [".codex", ".omp"] as const;

/**
 * Root configurations the solution references in addition to workspace
 * projects.
 */
const ROOT_CONFIGURATION_FILES = ["tsconfig.lib.json", "tsconfig.node.json", "tsconfig.test.json"] as const;

const isManifest = type({
	name: isNonEmptyString,
	"+": "ignore",
}).readonly();

const isReferenceObject = type({
	"+": "ignore",
	"path?": isMaybeString,
}).readonly();
const isTsConfig = type({
	"+": "ignore",
	"references?": isReferenceObject.array().readonly().or(isUndefined),
}).readonly();

async function readProjectAsync(rootDirectory: string, directory: string): Promise<string | undefined> {
	const packageDirectory = nodePath.join(rootDirectory, directory);
	const packageJson = nodePath.join(packageDirectory, "package.json");
	const isPackageJsonAccessible = await isFileAccessibleAsync(packageJson);
	if (!isPackageJsonAccessible) return undefined;

	const isTsConfigAccessible = await isFileAccessibleAsync(nodePath.join(packageDirectory, TSCONFIG_JSON));
	if (!isTsConfigAccessible) return undefined;

	isManifest.assert(JSON.parse(await readFile(packageJson, "utf8")));
	return directory;
}

function localeCompare(stringA: string, stringB: string): number {
	return stringA.localeCompare(stringB);
}

async function findProjectsAsync(rootDirectory: string): Promise<ReadonlyArray<string>> {
	const candidates = new Array<string>();
	let size = 0;
	for (const parent of PROJECT_PARENTS) {
		// oxlint-disable-next-line no-await-in-loop -- parents are read in declaration order
		const children = await readdir(nodePath.join(rootDirectory, parent), { withFileTypes: true });
		for (const child of children) if (child.isDirectory()) candidates[size++] = `${parent}/${child.name}`;
	}
	for (const standalone of STANDALONE_PROJECTS) candidates[size++] = standalone;

	const projects = await Promise.all(
		candidates.toSorted(localeCompare).map(async (directory) => readProjectAsync(rootDirectory, directory)),
	);
	return projects.filter((project) => project !== undefined);
}

async function readReferencesAsync(filePath: string): Promise<ReadonlyArray<string>> {
	const parsed = JSON.parse(await readFile(filePath, "utf8"));
	if (!isTsConfig.allows(parsed)) return [];

	const { references = [] } = isTsConfig.assert(parsed);
	return references.map((reference) => reference.path ?? "").toSorted(localeCompare);
}

async function writeReferencesAsync(filePath: string, referencePaths: ReadonlyArray<string>): Promise<void> {
	const references = referencePaths.map((path) => ({ path }));

	const parsed = JSON.parse(await readFile(filePath, "utf8"));
	const tsconfig = isReadonlyDictionaryOfUnknowns.assert(parsed);

	const ordered: DictionaryOfUnknowns = {};
	if ("extends" in tsconfig) ordered.extends = tsconfig.extends;
	if ("compilerOptions" in tsconfig) ordered.compilerOptions = tsconfig.compilerOptions;
	if (references.length > 0) ordered.references = references;
	for (const [key, value] of Object.entries(tsconfig)) {
		// `references` is owned by this script; an empty expected list must
		// remove the key instead of leaking the stale one back through.
		if (key === "references" || key in ordered) continue;
		ordered[key] = value;
	}

	await writeFile(filePath, `${JSON.stringify(ordered, undefined, "\t")}\n`, "utf8");
}

interface ConfigurationFile {
	readonly expectedReferences: ReadonlyArray<string>;
	readonly path: string;
}

async function collectConfigurationFilesAsync(rootDirectory: string): Promise<ReadonlyArray<ConfigurationFile>> {
	const projects = await findProjectsAsync(rootDirectory);
	return [
		...projects.map((directory) => ({
			expectedReferences: [],
			path: nodePath.join(directory, TSCONFIG_JSON),
		})),
		{
			expectedReferences: [...projects, ...ROOT_CONFIGURATION_FILES]
				.map((directory) => `./${directory}`)
				.toSorted(localeCompare),
			path: TSCONFIG_JSON,
		},
	];
}

function isSameReferences(actual: ReadonlyArray<string>, expected: ReadonlyArray<string>): boolean {
	return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export interface StaleReferences {
	readonly actualReferences: ReadonlyArray<string>;
	readonly expectedReferences: ReadonlyArray<string>;
	readonly path: string;
}

export async function findStaleReferencesAsync(rootDirectory: string): Promise<ReadonlyArray<StaleReferences>> {
	const configurationFiles = await collectConfigurationFilesAsync(rootDirectory);
	const staleReferences = new Array<StaleReferences>();
	let size = 0;

	for (const { expectedReferences, path } of configurationFiles) {
		// oxlint-disable-next-line no-await-in-loop -- sequential reads keep the report ordered
		const actualReferences = await readReferencesAsync(nodePath.join(rootDirectory, path));
		if (isSameReferences(actualReferences, expectedReferences)) continue;
		staleReferences[size++] = { actualReferences, expectedReferences, path };
	}
	return staleReferences;
}

export async function syncTsconfigReferencesAsync(rootDirectory: string): Promise<ReadonlyArray<StaleReferences>> {
	const staleReferences = await findStaleReferencesAsync(rootDirectory);
	for (const { expectedReferences, path } of staleReferences) {
		// oxlint-disable-next-line no-await-in-loop -- sequential writes keep the report ordered
		await writeReferencesAsync(nodePath.join(rootDirectory, path), expectedReferences);
	}
	return staleReferences;
}
