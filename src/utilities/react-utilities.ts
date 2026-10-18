import {
	isIdentifier,
	isImportDefaultSpecifier,
	isImportNamespaceSpecifier,
	isMemberExpression,
} from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import {
	getNamedImportName,
	getStaticMemberObjectVariable,
	hasImportDefinitionFrom,
	isNamedImportFrom,
} from "$oxc-utilities/import-binding-provenance";
import { getImportedName } from "$oxc-utilities/oxc-utilities";

import type { Definition, ESTree, SourceCode, Variable } from "oxlint-plugin-utilities";

export const ROBLOX_TS = "roblox-ts" as const;
export const STANDARD = "standard" as const;
export type Environment = typeof ROBLOX_TS | typeof STANDARD;

export interface ReactOptions {
	readonly environment?: unknown;
}

export const ENVIRONMENT_SCHEMA = {
	default: ROBLOX_TS,
	description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
	enum: [ROBLOX_TS, STANDARD] as const,
	type: "string",
};

export function isEnvironment(value: unknown): value is Environment {
	return value === ROBLOX_TS || value === STANDARD;
}

const STANDARD_REACT_SOURCES = new Set<string>(["react", "react-dom"]);
const ROBLOX_TS_REACT_SOURCES = new Set<string>(["@rbxts/react", "@rbxts/roact"]);

export function getReactSources(environment: Environment): ReadonlySet<string> {
	if (environment === STANDARD) return STANDARD_REACT_SOURCES;
	return ROBLOX_TS_REACT_SOURCES;
}

export function getReactSourcesFromOptions(value?: ReactOptions): ReadonlySet<string> {
	return getReactSources(getEnvironment(value));
}

export function isReactImport(node: ESTree.ImportDeclaration, reactSources: ReadonlySet<string>): boolean {
	return reactSources.has(node.source.value);
}

export function forEachReactNamedImport(
	node: ESTree.ImportDeclaration,
	reactSources: ReadonlySet<string>,
	reactNamespaces: Set<string>,
	onNamedImport: (importedName: string, localName: string) => void,
): void {
	if (!isReactImport(node, reactSources)) return;

	for (const specifier of node.specifiers) {
		if (isImportDefaultSpecifier(specifier) || isImportNamespaceSpecifier(specifier)) {
			reactNamespaces.add(specifier.local.name);
			continue;
		}

		const importedName = getImportedName(specifier);
		/* v8 ignore next -- @preserve import specifiers in parser import declarations have supported names. */
		if (importedName === undefined) continue;

		onNamedImport(importedName, specifier.local.name);
	}
}

export function getEnvironment(value?: ReactOptions): Environment {
	if (!Predicate.isObject(value) || value.environment !== STANDARD) return ROBLOX_TS;
	return STANDARD;
}

export function isReactNamedImport(
	variable: undefined | Variable,
	importedName: string,
	reactSources: ReadonlySet<string>,
): boolean {
	return isNamedImportFrom(variable, reactSources, importedName);
}

function isDefaultOrNamespaceSpecifier(node: Definition["node"]): boolean {
	return isImportDefaultSpecifier(node) || isImportNamespaceSpecifier(node);
}

export function isReactNamespaceImport(variable: undefined | Variable, reactSources: ReadonlySet<string>): boolean {
	return hasImportDefinitionFrom(variable, reactSources, isDefaultOrNamespaceSpecifier);
}

function hasReactNamedImport(
	variable: undefined | Variable,
	importedNames: ReadonlySet<string>,
	reactSources: ReadonlySet<string>,
): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		const importedName = getNamedImportName(definition, reactSources);
		if (importedName !== undefined && importedNames.has(importedName)) return true;
	}

	return false;
}

export function isReactImportedCall(
	sourceCode: SourceCode,
	{ callee }: ESTree.CallExpression,
	importedNames: ReadonlySet<string>,
	reactSources: ReadonlySet<string>,
): boolean {
	if (isIdentifier(callee)) {
		const variable = getVariableByName(sourceCode.getScope(callee), callee.name);
		return hasReactNamedImport(variable, importedNames, reactSources);
	}

	if (!isMemberExpression(callee) || !isIdentifier(callee.property)) return false;

	const variable = getStaticMemberObjectVariable(sourceCode, callee);
	return isReactNamespaceImport(variable, reactSources) && importedNames.has(callee.property.name);
}
