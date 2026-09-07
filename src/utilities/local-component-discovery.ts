import { existsSync, readdirSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { Predicate } from "effect";
import ignore from "ignore";

import { resolveRelativeImport } from "./resolve-import";

import type { Ignore } from "ignore";
import type { Dirent } from "node:fs";
import type { ESTree } from "oxlint-plugin-utilities";

export interface LocalComponentDefinition {
	readonly componentName: string;
	readonly fileNames: ReadonlyArray<string>;
	readonly markers?: ReadonlyArray<string>;
}

export interface LocalComponentInspection {
	readonly importStyle: "default" | "named" | undefined;
	readonly matches: boolean;
}

interface GitignoreLayer {
	readonly baseDirectory: string;
	readonly matcher: Ignore;
}

export type LocalComponentDiscovery =
	| { readonly found: false }
	| {
			readonly found: true;
			readonly importSource: string;
			readonly importStyle: "default" | "named" | undefined;
			readonly path: string;
	  };

const COMPONENT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const IGNORED_DIRECTORIES = new Set([
	".git",
	".next",
	".turbo",
	"__fixtures__",
	"__mocks__",
	"__tests__",
	"build",
	"coverage",
	"dist",
	"documentation",
	"example",
	"examples",
	"fixture",
	"fixtures",
	"include",
	"lib",
	"node_modules",
	"opensrc",
	"out",
	"out-test",
	"stories",
	"story",
	"test",
	"tests",
]);
const DEFAULT_EXPORT_PATTERN = /\bexport\s+default\b/u;
const INDEX_SUFFIX_PATTERN = /\/index$/u;
const SOURCE_EXTENSION_PATTERN = /\.(?:[cm]?jsx?|tsx?)$/u;

const fileIndexCache = new Map<string, ReadonlyMap<string, ReadonlyArray<string>>>();
const fileTextCache = new Map<string, string>();
const projectRootCache = new Map<string, string | undefined>();

const REGEXP_REGEXP = /[.*+?^${}()|[\]\\]/gu;
const AND = String.raw`\$&`;
function escapeRegExp(value: string): string {
	return value.replaceAll(REGEXP_REGEXP, AND);
}

/** @knipignore -- Test-only cache-eviction boundary. */
export const MAX_REGEX_CACHE_SIZE = 64;
const regexCache = new Map<string, RegExp>();

function ensureUnicodeFlag(flags: string): string {
	/* v8 ignore next -- @preserve callers pass freshly-created search regex flags without unicode flags. */
	return flags.includes("u") || flags.includes("v") ? flags : `${flags}u`;
}

function cachedRegex(pattern: string, flags: string): RegExp {
	const cacheKey = `${flags}:${pattern}`;
	const cached = regexCache.get(cacheKey);
	if (cached !== undefined) return cached;

	const regex = new RegExp(pattern, ensureUnicodeFlag(flags));
	if (regexCache.size >= MAX_REGEX_CACHE_SIZE) {
		const firstKey = regexCache.keys().next().value;
		/* v8 ignore next -- @preserve a nonempty cache always yields a first insertion key. */
		if (firstKey !== undefined) regexCache.delete(firstKey);
	}
	regexCache.set(cacheKey, regex);
	return regex;
}

function normalizePathSeparator(path: string): string {
	return path.replaceAll("\\", "/");
}

function getFileText(filePath: string): string {
	const cached = fileTextCache.get(filePath);
	if (cached !== undefined) return cached;

	const text = readFileSync(filePath, "utf8");
	fileTextCache.set(filePath, text);
	return text;
}

function getImportStyle(text: string, componentName: string): "default" | "named" | undefined {
	const escapedName = escapeRegExp(componentName);
	const hasNamedExport =
		cachedRegex(`\\bexport\\s+(?:const|function|class)\\s+${escapedName}\\b`, "u").test(text) ||
		cachedRegex(`\\bexport\\s*\\{[^}]*\\b${escapedName}\\b[^}]*\\}`, "u").test(text);
	if (hasNamedExport) return "named";

	return DEFAULT_EXPORT_PATTERN.test(text) && cachedRegex(`\\b${escapedName}\\b`, "u").test(text)
		? "default"
		: undefined;
}

function hasExpectedMarkers(text: string, markers: ReadonlyArray<string>): boolean {
	for (const marker of markers) {
		if (!cachedRegex(`\\b${escapeRegExp(marker)}\\b`, "u").test(text)) return false;
	}

	return true;
}

function getProjectRootFromDirectory(startDirectory: string): string | undefined {
	const cached = projectRootCache.get(startDirectory);
	if (cached !== undefined) return cached;

	let currentDirectory = startDirectory;
	while (true) {
		if (
			existsSync(nodePath.join(currentDirectory, "package.json")) ||
			existsSync(nodePath.join(currentDirectory, "tsconfig.json"))
		) {
			projectRootCache.set(startDirectory, currentDirectory);
			return currentDirectory;
		}

		const parentDirectory = nodePath.dirname(currentDirectory);
		if (parentDirectory === currentDirectory) {
			projectRootCache.set(startDirectory, undefined);
			return undefined;
		}

		currentDirectory = parentDirectory;
	}
}

/**
 * Reads the `.gitignore` of a directory that has just been listed.
 *
 * The listing already says whether the file is there, so the common case of a
 * directory without one costs no syscall at all.
 *
 * @param directory - The directory that was listed.
 * @param entries - That directory's entries.
 * @returns The layer, or `undefined` when there is no `.gitignore` to read.
 */
function readGitignoreLayer(directory: string, entries: ReadonlyArray<Dirent>): GitignoreLayer | undefined {
	if (entries.every((entry) => entry.name !== ".gitignore" || !entry.isFile())) return undefined;

	try {
		const contents = readFileSync(nodePath.join(directory, ".gitignore"), "utf8");
		return { baseDirectory: directory, matcher: ignore().add(contents) };
	} catch {
		/* v8 ignore next 2 -- @preserve the listing above proves the file was there a moment ago. */
		return undefined;
	}
}

/**
 * Applies the collected `.gitignore` layers to an entry, honoring git
 * precedence: the layer nearest the entry decides, so a nested negation can
 * re-include what an outer layer ignored.
 *
 * @param layers - The layers from the root down to the entry's own directory.
 * @param entryPath - The absolute path of the entry being tested.
 * @param isDirectory - Whether the entry is a directory.
 * @returns Whether git would ignore the entry.
 */
function isGitIgnored(layers: ReadonlyArray<GitignoreLayer>, entryPath: string, isDirectory: boolean): boolean {
	for (let index = layers.length - 1; index >= 0; index -= 1) {
		const layer = layers[index];
		/* v8 ignore next -- @preserve indices come from the array being iterated. */
		if (layer === undefined) continue;

		const relativePath = normalizePathSeparator(nodePath.relative(layer.baseDirectory, entryPath));
		/* v8 ignore next -- @preserve layers only ever cover ancestors of the entry. */
		if (relativePath.length === 0 || relativePath.startsWith("../")) continue;

		const result = layer.matcher.test(isDirectory ? `${relativePath}/` : relativePath);
		if (result.ignored) return true;
		if (result.unignored) return false;
	}

	return false;
}

/**
 * Lists a directory, treating any failure as an empty listing.
 *
 * The index is best-effort, and a concurrent build can delete a directory
 * between the moment its parent is listed and the moment it is visited.
 * Linting a source file must not fail because of that.
 *
 * @param directory - The directory to list.
 * @returns The entries, or nothing when the directory could not be read.
 */
function readDirectoryEntries(directory: string): ReadonlyArray<Dirent> {
	try {
		return readdirSync(directory, { withFileTypes: true });
	} catch {
		return [];
	}
}

/**
 * Decides whether the walk should look at an entry at all, before any of the
 * per-project `.gitignore` rules are consulted.
 *
 * @param entryName - The name of the entry within its directory.
 * @returns Whether the entry is skipped outright.
 */
function isSkippedEntryName(entryName: string): boolean {
	if (entryName.startsWith(".")) return entryName !== ".storybook";
	return IGNORED_DIRECTORIES.has(entryName.toLowerCase());
}

/**
 * Decides whether a walked entry belongs in the component index.
 *
 * @param entry - An entry of a walked directory that is not a directory.
 * @returns Whether the entry is a component file worth indexing.
 */
function isIndexableComponentFile(entry: Dirent): boolean {
	// Symbolic links are neither files nor directories here, so they are
	// skipped along with sockets and pipes; that keeps link cycles and
	// duplicate component paths out of the index.
	if (!entry.isFile()) return false;
	if (entry.name.endsWith(".d.ts")) return false;
	return COMPONENT_EXTENSIONS.has(nodePath.extname(entry.name));
}

function indexProjectFiles(rootDirectory: string): ReadonlyMap<string, ReadonlyArray<string>> {
	const cached = fileIndexCache.get(rootDirectory);
	if (cached !== undefined) return cached;

	const index = new Map<string, Array<string>>();

	function addComponentFile(entry: Dirent, fullPath: string): void {
		const baseName = nodePath.basename(entry.name, nodePath.extname(entry.name)).toLowerCase();
		const existing = index.get(baseName);
		if (existing === undefined) index.set(baseName, [fullPath]);
		else existing.push(fullPath);
	}

	function visit(directory: string, inheritedLayers: ReadonlyArray<GitignoreLayer>): void {
		const entries = readDirectoryEntries(directory);
		const ownLayer = readGitignoreLayer(directory, entries);
		const layers = ownLayer === undefined ? inheritedLayers : [...inheritedLayers, ownLayer];

		for (const entry of entries) {
			if (isSkippedEntryName(entry.name)) continue;

			// Matching an entry against the `.gitignore` layers is the most
			// expensive check here, so it runs last: only directories and files
			// that would actually be indexed ever reach it.
			const isDirectory = entry.isDirectory();
			if (!isDirectory && !isIndexableComponentFile(entry)) continue;

			const fullPath = nodePath.join(directory, entry.name);
			if (isGitIgnored(layers, fullPath, isDirectory)) continue;

			if (isDirectory) visit(fullPath, layers);
			else addComponentFile(entry, fullPath);
		}
	}

	visit(rootDirectory, []);

	const readonlyIndex = new Map<string, ReadonlyArray<string>>();
	for (const [key, value] of index) readonlyIndex.set(key, value);

	fileIndexCache.set(rootDirectory, readonlyIndex);
	return readonlyIndex;
}

function toImportSource(sourceFile: string, targetFile: string): string {
	let importSource = normalizePathSeparator(nodePath.relative(nodePath.dirname(sourceFile), targetFile));
	importSource = importSource.replace(SOURCE_EXTENSION_PATTERN, "");
	importSource = importSource.replace(INDEX_SUFFIX_PATTERN, "");

	if (!importSource.startsWith(".")) importSource = `./${importSource}`;
	return importSource;
}

function isIgnoredComponentPath(filePath: string): boolean {
	const projectRoot = getProjectRootFromDirectory(nodePath.dirname(filePath));
	const normalizedPath = normalizePathSeparator(
		/* v8 ignore next -- @preserve discovered component paths come from files under a project root. */
		projectRoot === undefined ? filePath : nodePath.relative(projectRoot, filePath),
	);
	for (const segment of normalizedPath.split("/")) {
		if (IGNORED_DIRECTORIES.has(segment.toLowerCase())) return true;
	}

	return false;
}

export function inspectLocalComponentFile(
	filePath: string,
	definition: LocalComponentDefinition,
): LocalComponentInspection {
	if (isIgnoredComponentPath(filePath)) return { importStyle: undefined, matches: false };

	const extension = nodePath.extname(filePath);
	if (!COMPONENT_EXTENSIONS.has(extension) || filePath.endsWith(".d.ts")) {
		return { importStyle: undefined, matches: false };
	}

	const baseName = nodePath.basename(filePath, extension).toLowerCase();
	const fileNames = definition.fileNames.map((fileName) => fileName.toLowerCase());
	if (!fileNames.includes(baseName)) return { importStyle: undefined, matches: false };

	const text = getFileText(filePath);
	if (!cachedRegex(`\\b${escapeRegExp(definition.componentName)}\\b`, "u").test(text)) {
		return { importStyle: undefined, matches: false };
	}

	if (definition.markers !== undefined && !hasExpectedMarkers(text, definition.markers)) {
		return { importStyle: undefined, matches: false };
	}

	const importStyle = getImportStyle(text, definition.componentName);
	if (importStyle === undefined) return { importStyle: undefined, matches: false };

	return {
		importStyle,
		matches: true,
	};
}

export function inspectRelativeLocalComponentImport(
	node: ESTree.ImportDeclaration,
	filename: string,
	definition: LocalComponentDefinition,
): LocalComponentInspection {
	const importSource = node.source.value;
	if (!Predicate.isString(importSource) || !importSource.startsWith(".") || filename.length === 0) {
		return { importStyle: undefined, matches: false };
	}

	const resolved = resolveRelativeImport(importSource, filename);
	if (!resolved.found) return { importStyle: undefined, matches: false };

	return inspectLocalComponentFile(resolved.path, definition);
}

export function addLocalComponentImportIdentifiers(
	node: ESTree.ImportDeclaration,
	inspection: LocalComponentInspection,
	componentName: string,
	identifiers: Set<string>,
): void {
	if (!inspection.matches) return;

	for (const specifier of node.specifiers) {
		if (specifier.type === "ImportDefaultSpecifier") {
			identifiers.add(specifier.local.name);
			continue;
		}

		if (specifier.type !== "ImportSpecifier") continue;

		const { imported } = specifier;
		const importedName = imported.type === "Identifier" ? imported.name : imported.value;
		if (importedName === componentName) identifiers.add(specifier.local.name);
	}
}

function discoverLocalComponent(sourceFile: string, definition: LocalComponentDefinition): LocalComponentDiscovery {
	const projectRoot = getProjectRootFromDirectory(nodePath.dirname(sourceFile));
	if (projectRoot === undefined) return { found: false };

	const projectFiles = indexProjectFiles(projectRoot);
	const candidatePaths = new Set<string>();
	for (const fileName of definition.fileNames) {
		const files = projectFiles.get(fileName.toLowerCase()) ?? [];
		for (const candidatePath of files) candidatePaths.add(candidatePath);
	}

	const matches = [...candidatePaths].filter(
		(candidatePath) => inspectLocalComponentFile(candidatePath, definition).matches,
	);
	if (matches.length !== 1) return { found: false };

	const [path] = matches;
	/* v8 ignore next -- @preserve The length check above guarantees one destructured path. */
	if (path === undefined) return { found: false };

	const inspection = inspectLocalComponentFile(path, definition);
	return {
		found: true,
		importSource: toImportSource(sourceFile, path),
		importStyle: inspection.importStyle,
		path,
	};
}

/**
 * Defers {@link discoverLocalComponent} until a rule needs the answer.
 *
 * The first discovery in a project indexes its source tree, so rules should
 * only ask once they have found a node worth reporting; a file with no such
 * node then never pays for the walk.
 *
 * @param sourceFile - The linted file; an empty name resolves nothing.
 * @param definition - The component to look for.
 * @returns A memoized accessor for the discovery result.
 */
export function createLocalComponentDiscoverer(
	sourceFile: string,
	definition: LocalComponentDefinition,
): () => LocalComponentDiscovery {
	let discovery: LocalComponentDiscovery | undefined;
	return function discover(): LocalComponentDiscovery {
		discovery ??= sourceFile.length === 0 ? { found: false } : discoverLocalComponent(sourceFile, definition);
		return discovery;
	};
}
