import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { getImportedName } from "$oxc-utilities/oxc-utilities";
import { isRecord } from "$oxc-utilities/type-utilities";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "./ast-utilities";

export type Environment = "roblox-ts" | "standard";

export const ENVIRONMENT_SCHEMA = {
	default: "roblox-ts",
	description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
	enum: ["roblox-ts", "standard"] as const,
	type: "string",
};

export function isEnvironment(value: unknown): value is Environment {
	return value === "roblox-ts" || value === "standard";
}

const STANDARD_REACT_SOURCES = new Set<string>(["react", "react-dom"]);
const ROBLOX_TS_REACT_SOURCES = new Set<string>(["@rbxts/react", "@rbxts/roact"]);

export function getReactSources(environment: Environment): ReadonlySet<string> {
	if (environment === "standard") return STANDARD_REACT_SOURCES;
	return ROBLOX_TS_REACT_SOURCES;
}

export function getReactSourcesFromOptions(value: unknown): ReadonlySet<string> {
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
		if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportNamespaceSpecifier") {
			reactNamespaces.add(specifier.local.name);
			continue;
		}

		const importedName = getImportedName(specifier);
		/* v8 ignore next -- @preserve import specifiers in parser import declarations have supported names. */
		if (importedName === undefined) continue;

		onNamedImport(importedName, specifier.local.name);
	}
}

export function getEnvironment(value: unknown): Environment {
	if (!isRecord(value) || value.environment !== "standard") return "roblox-ts";
	return "standard";
}

function getImportDeclarationParent(node: ESTree.Node): ESTree.ImportDeclaration | undefined {
	/* v8 ignore next -- parser import bindings retain their ImportDeclaration parent. @preserve */
	return node.parent?.type === "ImportDeclaration" ? node.parent : undefined;
}

export function isReactImportDefinition(
	definition: ScopeVariable["defs"][number],
	reactSources: ReadonlySet<string>,
): boolean {
	if (definition.type !== "ImportBinding") return false;

	const importDeclaration = getImportDeclarationParent(definition.node);
	/* v8 ignore next -- ImportBinding definitions are parser-parented by an ImportDeclaration. @preserve */
	if (importDeclaration === undefined) return false;

	return reactSources.has(importDeclaration.source.value);
}

export function isReactNamedImport(
	variable: ScopeVariable | undefined,
	importedName: string,
	reactSources: ReadonlySet<string>,
): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (!isReactImportDefinition(definition, reactSources)) continue;
		/* v8 ignore next -- named-import scope lookups expose ImportSpecifier definitions here. @preserve */
		if (definition.node.type !== "ImportSpecifier") continue;
		if (getImportedName(definition.node) === importedName) return true;
	}

	return false;
}

export function isReactNamespaceImport(
	variable: ScopeVariable | undefined,
	reactSources: ReadonlySet<string>,
): boolean {
	/* v8 ignore next -- Idc */
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (!isReactImportDefinition(definition, reactSources)) continue;
		/* v8 ignore next -- React namespace checks only reach default or namespace import definitions. @preserve */
		if (definition.node.type === "ImportDefaultSpecifier" || definition.node.type === "ImportNamespaceSpecifier") {
			return true;
		}
	}

	return false;
}

export function isReactImportedCall(
	sourceCode: SourceCode,
	{ callee }: ESTree.CallExpression,
	importedNames: ReadonlySet<string>,
	reactSources: ReadonlySet<string>,
): boolean {
	if (callee.type === "Identifier") {
		const variable = getVariableByName(sourceCode.getScope(callee), callee.name);
		if (variable === undefined) return false;

		return variable.defs.some((definition) => {
			if (definition.type !== "ImportBinding" || definition.node.type !== "ImportSpecifier") return false;
			const importDeclaration = getImportDeclarationParent(definition.node);
			if (importDeclaration === undefined || !reactSources.has(importDeclaration.source.value)) {
				return false;
			}
			const importedName = getImportedName(definition.node);
			return importedName !== undefined && importedNames.has(importedName);
		});
	}

	if (callee.type !== "MemberExpression" || callee.computed) return false;
	if (callee.object.type !== "Identifier" || callee.property.type !== "Identifier") return false;

	const variable = getVariableByName(sourceCode.getScope(callee.object), callee.object.name);
	return isReactNamespaceImport(variable, reactSources) && importedNames.has(callee.property.name);
}
