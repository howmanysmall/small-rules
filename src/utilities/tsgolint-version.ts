import { existsSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { isMaybeReadonlyDictionaryOfStrings, isMaybeString, isUndefined } from "@small-rules/arktype-utilities";
import { type } from "arktype";

import type { MaybeReadonlyDictionaryOfStrings } from "@small-rules/arktype-utilities";

const PLUGIN_SETTINGS_KEY = "small-rules";
const PACKAGE_MANIFEST = "package.json";
const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";
const TSGOLINT_PACKAGE = "oxlint-tsgolint";
const CATALOG_PREFIX = "catalog:";
const VERSION_MARKER = "oxlint-tsgolint:";
const ASSERTION_SYNTAX_MAJOR = 7;
const ASSERTION_SYNTAX_MINOR = 0;
const ASSERTION_SYNTAX_PATCH = 2002;
const LEADING_DIGITS = /^\d+/u;
const CARET_OR_TILDE = /^[~^]/u;

const isPluginSettings = type({
	"+": "reject",
	"tsgolintVersion?": isMaybeString,
}).readonly();

export const isLintSettings = type({
	"+": "ignore",
	"small-rules?": isPluginSettings.or(isUndefined),
}).readonly();
export type LintSettings = typeof isLintSettings.infer;

const isPackageManifest = type({
	"+": "ignore",
	"dependencies?": isMaybeReadonlyDictionaryOfStrings,
	"devDependencies?": isMaybeReadonlyDictionaryOfStrings,
}).readonly();
type PackageManifest = typeof isPackageManifest.infer;

const isInstalledManifest = type({
	"+": "ignore",
	"version?": isMaybeString,
}).readonly();
type InstalledManifest = typeof isInstalledManifest.infer;

const inferredVersionCache = new Map<string, string | undefined>();

export function getTsgoLintVersionFromSettings(lintSettings: LintSettings): string | undefined {
	return lintSettings[PLUGIN_SETTINGS_KEY]?.tsgolintVersion;
}

export function inferTsgoLintVersion(fromDirectory: string): string | undefined {
	const root = getProjectRoot(fromDirectory);
	if (root === undefined) return undefined;

	const cached = inferredVersionCache.get(root);
	if (cached !== undefined) return cached;

	const version =
		getVersionFromInstalledPackage(root) ??
		versionFromWorkspaceCatalog(root) ??
		getVersionFromPackageManifest(root);
	inferredVersionCache.set(root, version);
	return version;
}

export function resolveTsgoLintVersion(
	lintSettings: LintSettings | undefined,
	fromDirectory: string,
): string | undefined {
	const fromSettings = lintSettings === undefined ? undefined : getTsgoLintVersionFromSettings(lintSettings);
	return fromSettings ?? inferTsgoLintVersion(fromDirectory);
}

export function usesAssertionSyntaxDiagnosticRange(version?: string): boolean {
	if (version === undefined) return false;

	const parsed = parseDottedVersion(version);
	if (parsed === undefined) return false;

	return isAtLeastAssertionSyntaxVersion(parsed[0], parsed[1], parsed[2]);
}

function getProjectRoot(startDirectory: string): string | undefined {
	let currentDirectory = startDirectory;
	while (true) {
		if (isProjectRoot(currentDirectory)) return currentDirectory;

		const parentDirectory = nodePath.dirname(currentDirectory);
		if (parentDirectory === currentDirectory) return undefined;

		currentDirectory = parentDirectory;
	}
}

function isProjectRoot(directory: string): boolean {
	return (
		existsSync(nodePath.join(directory, PACKAGE_MANIFEST)) ||
		existsSync(nodePath.join(directory, WORKSPACE_MANIFEST))
	);
}

function getVersionFromInstalledPackage(root: string): string | undefined {
	return readInstalledManifest(nodePath.join(root, "node_modules", TSGOLINT_PACKAGE, PACKAGE_MANIFEST))?.version;
}

function versionFromWorkspaceCatalog(root: string): string | undefined {
	const text = readText(nodePath.join(root, WORKSPACE_MANIFEST));
	if (text === undefined) return undefined;

	const markerStart = text.indexOf(VERSION_MARKER);
	if (markerStart === -1) return undefined;

	return getLeadingVersion(stripQuotes(text.slice(markerStart + VERSION_MARKER.length).trimStart()));
}

function getVersionFromPackageManifest(root: string): string | undefined {
	const manifest = readPackageManifest(nodePath.join(root, PACKAGE_MANIFEST));
	if (manifest === undefined) return undefined;

	return getConcreteSpecifier(manifest.devDependencies) ?? getConcreteSpecifier(manifest.dependencies);
}

function getConcreteSpecifier(section: MaybeReadonlyDictionaryOfStrings): string | undefined {
	if (section === undefined) return undefined;

	const specifier = section[TSGOLINT_PACKAGE];
	if (specifier === undefined || specifier.startsWith(CATALOG_PREFIX)) return undefined;

	return specifier.replace(CARET_OR_TILDE, "");
}

function readPackageManifest(filePath: string): PackageManifest | undefined {
	const text = readText(filePath);
	if (text === undefined) return undefined;

	try {
		const parsed = JSON.parse(text);
		return isPackageManifest.allows(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function readInstalledManifest(filePath: string): InstalledManifest | undefined {
	const text = readText(filePath);
	if (text === undefined) return undefined;

	try {
		const parsed = JSON.parse(text);
		return isInstalledManifest.allows(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function readText(filePath: string): string | undefined {
	try {
		return readFileSync(filePath, "utf8");
	} catch {
		return undefined;
	}
}

function stripQuotes(text: string): string {
	const [first] = text;
	return first === '"' || first === "'" ? text.slice(1) : text;
}

function getLeadingVersion(text: string): string | undefined {
	const [majorText, minorText, patchText] = text.split(".", 3);
	if (majorText === undefined || minorText === undefined || patchText === undefined) return undefined;

	const parsed = parseDottedVersion(`${majorText}.${minorText}.${patchText}`);
	if (parsed === undefined) return undefined;

	return `${parsed[0]}.${parsed[1]}.${parsed[2]}`;
}

function parseDottedVersion(version: string): readonly [major: number, minor: number, patch: number] | undefined {
	const [majorText, minorText, patchText] = version.split(".", 3);
	if (majorText === undefined || minorText === undefined || patchText === undefined) return undefined;

	const major = parseLeadingInteger(majorText);
	const minor = parseLeadingInteger(minorText);
	const patch = parseLeadingInteger(patchText);
	if (major === undefined || minor === undefined || patch === undefined) return undefined;

	return [major, minor, patch];
}

function parseLeadingInteger(text: string): number | undefined {
	const digits = LEADING_DIGITS.exec(text)?.[0];
	return digits === undefined ? undefined : Number(digits);
}

function isAtLeastAssertionSyntaxVersion(major: number, minor: number, patch: number): boolean {
	if (major !== ASSERTION_SYNTAX_MAJOR) return major > ASSERTION_SYNTAX_MAJOR;
	if (minor !== ASSERTION_SYNTAX_MINOR) return minor > ASSERTION_SYNTAX_MINOR;
	return patch >= ASSERTION_SYNTAX_PATCH;
}
