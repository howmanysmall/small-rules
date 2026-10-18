import {
	isIdentifier,
	isIdentifierNamed,
	isImportDeclaration,
	isImportNamespaceSpecifier,
	isImportSpecifier,
	isMemberExpression,
} from "@small-rules/oxlint-utilities";

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { getImportedName } from "$oxc-utilities/oxc-utilities";

import type { Definition, ESTree, SourceCode, Variable } from "oxlint-plugin-utilities";

export function isImportDefinitionFrom(definition: Definition, sources: ReadonlySet<string>): boolean {
	if (definition.type !== "ImportBinding") return false;

	const declaration = definition.node.parent;
	return isImportDeclaration(declaration) && sources.has(declaration.source.value);
}

export function hasImportDefinitionFrom(
	variable: undefined | Variable,
	sources: ReadonlySet<string>,
	matchesSpecifier: (node: Definition["node"]) => boolean,
): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (isImportDefinitionFrom(definition, sources) && matchesSpecifier(definition.node)) return true;
	}

	return false;
}

export function getNamedImportName(definition: Definition, sources: ReadonlySet<string>): string | undefined {
	if (!isImportDefinitionFrom(definition, sources) || !isImportSpecifier(definition.node)) return undefined;
	return getImportedName(definition.node);
}

export function isNamedImportFrom(
	variable: undefined | Variable,
	sources: ReadonlySet<string>,
	importedName: string,
): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (getNamedImportName(definition, sources) === importedName) return true;
	}

	return false;
}

/**
 * Whether `callee` resolves to `importedName` imported from one of `sources`,
 * either as a named import (`name()`) or through a namespace import
 * (`namespace.name()`).
 *
 * @returns Whether the callee is the imported binding.
 */
export function isImportedCallee(
	sourceCode: SourceCode,
	callee: ESTree.CallExpression["callee"],
	sources: ReadonlySet<string>,
	importedName: string,
): boolean {
	if (isIdentifier(callee)) {
		return isNamedImportFrom(getVariableByName(sourceCode.getScope(callee), callee.name), sources, importedName);
	}

	if (!isMemberExpression(callee) || !isIdentifierNamed(callee.property, importedName)) return false;

	const variable = getStaticMemberObjectVariable(sourceCode, callee);
	return hasImportDefinitionFrom(variable, sources, isImportNamespaceSpecifier);
}

export function getStaticMemberObjectVariable(
	sourceCode: SourceCode,
	member: ESTree.MemberExpression,
): undefined | Variable {
	if (member.computed || !isIdentifier(member.object)) return undefined;
	return getVariableByName(sourceCode.getScope(member.object), member.object.name);
}
