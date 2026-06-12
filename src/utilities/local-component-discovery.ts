import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";

import { resolveRelativeImport } from "./resolve-import";

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

type LocalComponentDiscovery =
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
	"coverage",
	"dist",
	"documentation",
	"example",
	"examples",
	"fixture",
	"fixtures",
	"node_modules",
	"opensrc",
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

const MAX_REGEX_CACHE_SIZE = 64;
const regexCache = new Map<string, RegExp>();

function ensureUnicodeFlag(flags: string): string {
	return flags.includes("u") || flags.includes("v") ? flags : `${flags}u`;
}

function cachedRegex(pattern: string, flags: string): RegExp {
	const cacheKey = `${flags}:${pattern}`;
	const cached = regexCache.get(cacheKey);
	if (cached !== undefined) return cached;

	const regex = new RegExp(pattern, ensureUnicodeFlag(flags));
	if (regexCache.size >= MAX_REGEX_CACHE_SIZE) {
		const firstKey = regexCache.keys().next().value;
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
		if (existsSync(join(currentDirectory, "package.json")) || existsSync(join(currentDirectory, "tsconfig.json"))) {
			projectRootCache.set(startDirectory, currentDirectory);
			return currentDirectory;
		}

		const parentDirectory = dirname(currentDirectory);
		if (parentDirectory === currentDirectory) {
			projectRootCache.set(startDirectory, undefined);
			return undefined;
		}

		currentDirectory = parentDirectory;
	}
}

function indexProjectFiles(rootDirectory: string): ReadonlyMap<string, ReadonlyArray<string>> {
	const cached = fileIndexCache.get(rootDirectory);
	if (cached !== undefined) return cached;

	const index = new Map<string, Array<string>>();

	function visit(directory: string): void {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const entryName = entry.name.toLowerCase();
			if ((entry.name.startsWith(".") && entry.name !== ".storybook") || IGNORED_DIRECTORIES.has(entryName)) {
				continue;
			}

			const fullPath = join(directory, entry.name);
			if (entry.isDirectory()) {
				visit(fullPath);
				continue;
			}

			const extension = extname(entry.name);
			if (!COMPONENT_EXTENSIONS.has(extension)) continue;
			if (entry.name.endsWith(".d.ts")) continue;

			const baseName = basename(entry.name, extension).toLowerCase();
			const existing = index.get(baseName);
			if (existing === undefined) index.set(baseName, [fullPath]);
			else existing.push(fullPath);
		}
	}

	visit(rootDirectory);

	const readonlyIndex = new Map<string, ReadonlyArray<string>>();
	for (const [key, value] of index) readonlyIndex.set(key, value);

	fileIndexCache.set(rootDirectory, readonlyIndex);
	return readonlyIndex;
}

function toImportSource(sourceFile: string, targetFile: string): string {
	let importSource = normalizePathSeparator(relative(dirname(sourceFile), targetFile));
	importSource = importSource.replace(SOURCE_EXTENSION_PATTERN, "");
	importSource = importSource.replace(INDEX_SUFFIX_PATTERN, "");

	if (!importSource.startsWith(".")) importSource = `./${importSource}`;
	return importSource;
}

function isIgnoredComponentPath(filePath: string): boolean {
	const projectRoot = getProjectRootFromDirectory(dirname(filePath));
	const normalizedPath = normalizePathSeparator(
		projectRoot === undefined ? filePath : relative(projectRoot, filePath),
	);
	for (const segment of normalizedPath.split("/")) {
		if (IGNORED_DIRECTORIES.has(segment.toLowerCase())) return true;
	}

	return false;
}

function inspectLocalComponentFile(filePath: string, definition: LocalComponentDefinition): LocalComponentInspection {
	if (isIgnoredComponentPath(filePath)) return { importStyle: undefined, matches: false };

	const extension = extname(filePath);
	if (!COMPONENT_EXTENSIONS.has(extension) || filePath.endsWith(".d.ts")) {
		return { importStyle: undefined, matches: false };
	}

	const baseName = basename(filePath, extension).toLowerCase();
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
	if (typeof importSource !== "string" || !importSource.startsWith(".") || filename === "") {
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

export function discoverLocalComponent(
	sourceFile: string,
	definition: LocalComponentDefinition,
): LocalComponentDiscovery {
	const projectRoot = getProjectRootFromDirectory(dirname(sourceFile));
	if (projectRoot === undefined) return { found: false };

	const projectFiles = indexProjectFiles(projectRoot);
	const candidatePaths = new Set<string>();
	for (const fileName of definition.fileNames) {
		for (const candidatePath of projectFiles.get(fileName.toLowerCase()) ?? []) candidatePaths.add(candidatePath);
	}

	const matches = [...candidatePaths].filter(
		(candidatePath) => inspectLocalComponentFile(candidatePath, definition).matches,
	);
	if (matches.length !== 1) return { found: false };

	const [path] = matches;
	if (path === undefined) return { found: false };

	const inspection = inspectLocalComponentFile(path, definition);
	return {
		found: true,
		importSource: toImportSource(sourceFile, path),
		importStyle: inspection.importStyle,
		path,
	};
}
