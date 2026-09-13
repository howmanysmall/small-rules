import { Predicate } from "effect";

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import {
	getImportedName,
	isIdentifierName,
	isImportDeclaration,
	isImportDefaultSpecifier,
	isImportNamespaceSpecifier,
	isImportSpecifier,
	isMemberExpression,
} from "$oxc-utilities/oxc-utilities";

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

export function getReactSourcesFromOptions(value: ReactOptions | undefined): ReadonlySet<string> {
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

export function getEnvironment(value: ReactOptions | undefined): Environment {
	if (!Predicate.isObject(value) || value.environment !== STANDARD) return ROBLOX_TS;
	return STANDARD;
}

function getImportDeclarationParent(node: ESTree.Node): ESTree.ImportDeclaration | undefined {
	/* v8 ignore next -- parser import bindings retain their ImportDeclaration parent. @preserve */
	return isImportDeclaration(node.parent) ? node.parent : undefined;
}

export function isReactImportDefinition(definition: Definition, reactSources: ReadonlySet<string>): boolean {
	if (definition.type !== "ImportBinding") return false;

	const importDeclaration = getImportDeclarationParent(definition.node);
	/* v8 ignore next -- ImportBinding definitions are parser-parented by an ImportDeclaration. @preserve */
	if (importDeclaration === undefined) return false;

	return reactSources.has(importDeclaration.source.value);
}

export function isReactNamedImport(
	variable: undefined | Variable,
	importedName: string,
	reactSources: ReadonlySet<string>,
): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (!isReactImportDefinition(definition, reactSources)) continue;
		/* v8 ignore next -- named-import scope lookups expose ImportSpecifier definitions here. @preserve */
		if (!isImportSpecifier(definition.node)) continue;
		if (getImportedName(definition.node) === importedName) return true;
	}

	return false;
}

export function isReactNamespaceImport(variable: undefined | Variable, reactSources: ReadonlySet<string>): boolean {
	/* v8 ignore next -- Idc */
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (!isReactImportDefinition(definition, reactSources)) continue;
		/* v8 ignore next -- React namespace checks only reach default or namespace import definitions. @preserve */
		if (isImportDefaultSpecifier(definition.node) || isImportNamespaceSpecifier(definition.node)) return true;
	}

	return false;
}

export function isReactImportedCall(
	sourceCode: SourceCode,
	{ callee }: ESTree.CallExpression,
	importedNames: ReadonlySet<string>,
	reactSources: ReadonlySet<string>,
): boolean {
	if (isIdentifierName(callee)) {
		const variable = getVariableByName(sourceCode.getScope(callee), callee.name);
		if (variable === undefined) return false;

		return variable.defs.some((definition) => {
			if (definition.type !== "ImportBinding" || !isImportSpecifier(definition.node)) return false;
			const importDeclaration = getImportDeclarationParent(definition.node);
			if (importDeclaration === undefined || !reactSources.has(importDeclaration.source.value)) {
				return false;
			}
			const importedName = getImportedName(definition.node);
			return importedName !== undefined && importedNames.has(importedName);
		});
	}

	if (!isMemberExpression(callee) || callee.computed) return false;
	if (!isIdentifierName(callee.object) || !isIdentifierName(callee.property)) return false;

	const variable = getVariableByName(sourceCode.getScope(callee.object), callee.object.name);
	return isReactNamespaceImport(variable, reactSources) && importedNames.has(callee.property.name);
}
