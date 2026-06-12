import { getVariableByName } from "$oxc-utilities/ast-utilities";
import {
	hasName,
	isAssignmentExpression,
	isAssignmentPattern,
	isClass,
	isExportNamedDeclaration,
	isExportSpecifier,
	isFunctionDeclaration,
	isIdentifierName,
	isImportDeclaration,
	isImportDefaultSpecifier,
	isImportNamespaceSpecifier,
	isImportSpecifier,
	isJsxIdentifier,
	isMemberExpression,
	isMethodDefinition,
	isObjectExpression,
	isObjectPattern,
	isProperty,
	isPropertyDefinition,
	isStaticRequire,
	isStringLiteral,
	isTsPropertySignature,
	isTsTypeAliasDeclaration,
	isVariableDeclaration,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";

import { isValidIdentifier } from "./identifier";

import type { Definition, ESTree, Fix, Fixer, Scope, Variable } from "oxlint-plugin-utilities";

import type { BroadIdentifier, ImportCheckOption, IsSafe, VariableLike } from "./types";

interface NodeRange {
	readonly range: [number, number];
}

export function getScopes(scope: Scope): Array<Scope> {
	const result = [scope];
	let size = 1;
	for (const child of scope.childScopes) {
		const childScopes = getScopes(child);
		for (const childScope of childScopes) result[size++] = childScope;
	}
	return result;
}

function isSafeName(name: string, scopes: ReadonlyArray<Scope>): boolean {
	return !scopes.some((scope) => getVariableByName(scope, name) !== undefined);
}

export function getAvailableVariableName(
	name: string,
	scopes: ReadonlyArray<Scope>,
	isSafe: IsSafe,
): string | undefined {
	let candidate = name;
	if (!isValidIdentifier(candidate)) {
		candidate = `${candidate}_`;
		if (!isValidIdentifier(candidate)) return undefined;
	}

	while (!(isSafeName(candidate, scopes) && isSafe(candidate, scopes))) candidate = `${candidate}_`;
	return candidate;
}

function getVariableIdentifiers(variable: VariableLike): ReadonlyArray<BroadIdentifier> {
	const identifiers = new Set<BroadIdentifier>();
	for (const identifier of variable.identifiers) identifiers.add(identifier);
	for (const { identifier } of variable.references) identifiers.add(identifier);
	return [...identifiers];
}

function hasSameRange(node1: NodeRange, node2: NodeRange): boolean {
	return node1.range[0] === node2.range[0] && node1.range[1] === node2.range[1];
}

export function isShorthandImportLocal(node: ESTree.BindingIdentifier | ESTree.IdentifierName): boolean {
	const { parent } = node;
	if (!isImportSpecifier(parent) || parent.local !== node) return false;
	return hasSameRange(parent.local, parent.imported);
}

function isShorthandExportLocal(node: ESTree.BindingIdentifier | ESTree.IdentifierName): boolean {
	const { parent } = node;
	if (!isExportSpecifier(parent) || parent.local !== node) return false;
	return hasSameRange(parent.local, parent.exported);
}

export function isShorthandPropertyValue(identifier: BroadIdentifier): boolean {
	if (!hasName(identifier)) return false;
	const { parent } = identifier;
	return isProperty(parent) && parent.shorthand && parent.value === identifier;
}

function isShorthandPropertyAssignmentPatternLeft(identifier: BroadIdentifier): boolean {
	if (!hasName(identifier)) return false;

	const { parent } = identifier;
	if (!isAssignmentPattern(parent) || parent.left !== identifier) return false;

	const property = parent.parent;
	if (!isProperty(property)) return false;
	return property.shorthand;
}

export function isDefaultOrNamespaceImportName(identifier: BroadIdentifier): boolean {
	if (!hasName(identifier)) return false;

	const { parent } = identifier;
	if (
		(isImportDefaultSpecifier(parent) && parent.local === identifier) ||
		(isImportNamespaceSpecifier(parent) && parent.local === identifier)
	) {
		return true;
	}

	if (isImportSpecifier(parent) && parent.local === identifier) {
		const { imported } = parent;
		if (isIdentifierName(imported) && imported.name === "default") return true;
	}

	return (
		isVariableDeclarator(parent) && parent.id === identifier && parent.init !== null && isStaticRequire(parent.init)
	);
}

function isExportedIdentifier(identifier: BroadIdentifier): boolean {
	if (!hasName(identifier)) return false;
	const { parent } = identifier;

	if (isVariableDeclarator(parent) && parent.id === identifier) {
		const declaration = parent.parent;
		return isVariableDeclaration(declaration) ? isExportNamedDeclaration(declaration.parent) : false;
	}

	if (isFunctionDeclaration(parent) && parent.id === identifier) {
		return isExportNamedDeclaration(parent.parent);
	}

	if (isClass(parent) && parent.id === identifier) return isExportNamedDeclaration(parent.parent);
	if (isTsTypeAliasDeclaration(parent) && parent.id === identifier) {
		return isExportNamedDeclaration(parent.parent);
	}

	return false;
}

export function shouldFix(variable: VariableLike): boolean {
	return getVariableIdentifiers(variable).every(
		(identifier) => !(isExportedIdentifier(identifier) || isJsxIdentifier(identifier)),
	);
}

function replaceReferenceIdentifier(identifier: BroadIdentifier, replacement: string, fixer: Fixer): Fix | undefined {
	if (!hasName(identifier)) return undefined;

	if (isShorthandPropertyValue(identifier) || isShorthandPropertyAssignmentPatternLeft(identifier)) {
		return fixer.replaceText(identifier, `${identifier.name}: ${replacement}`);
	}

	if (isShorthandImportLocal(identifier)) {
		return fixer.replaceText(identifier, `${identifier.name} as ${replacement}`);
	}

	if (isShorthandExportLocal(identifier)) {
		return fixer.replaceText(identifier, `${replacement} as ${identifier.name}`);
	}

	return fixer.replaceText(identifier, replacement);
}

export function renameVariable(variable: VariableLike, replacement: string, fixer: Fixer): Array<Fix> {
	const fixes = new Array<Fix>();
	let size = 0;
	for (const identifier of getVariableIdentifiers(variable)) {
		const fix = replaceReferenceIdentifier(identifier, replacement, fixer);
		if (fix !== undefined) fixes[size++] = fix;
	}
	return fixes;
}

export function shouldReportIdentifierAsProperty(identifier: BroadIdentifier): boolean {
	if (!hasName(identifier)) return false;
	const { parent } = identifier;
	if (isMemberExpression(parent) && parent.property === identifier && !parent.computed) {
		const parentParent = parent.parent;
		if (isAssignmentExpression(parentParent) && parentParent.left === parent) return true;
	}

	if (
		isProperty(parent) &&
		parent.key === identifier &&
		!parent.computed &&
		!parent.shorthand &&
		(isObjectExpression(parent.parent) || isObjectPattern(parent.parent))
	) {
		return true;
	}

	if (isTsPropertySignature(parent) && parent.key === identifier && !parent.computed) {
		return true;
	}

	if (isExportSpecifier(parent) && parent.exported === identifier && parent.local !== identifier) return true;

	return (
		(isMethodDefinition(parent) || isPropertyDefinition(parent)) && parent.key === identifier && !parent.computed
	);
}

export function isObjectPropertyKey(identifier: BroadIdentifier): boolean {
	if (!hasName(identifier)) return false;
	const { parent } = identifier;
	return (
		isProperty(parent) &&
		parent.key === identifier &&
		!parent.computed &&
		!parent.shorthand &&
		(isObjectExpression(parent.parent) || isObjectPattern(parent.parent))
	);
}

function getImportSource(definition: Definition): string | undefined {
	if (definition.type === "ImportBinding") {
		const { parent } = definition;
		if (parent !== null && isImportDeclaration(parent) && isStringLiteral(parent.source)) {
			return parent.source.value;
		}
	}

	if (definition.type === "Variable") {
		const { node } = definition;
		if (isVariableDeclarator(node) && node.init !== null && isStaticRequire(node.init)) {
			const [argument] = node.init.arguments;
			if (argument !== undefined && isStringLiteral(argument)) return argument.value;
		}
	}

	return undefined;
}

function isInternalImport(definition: Definition): boolean {
	const source = getImportSource(definition);
	if (source === undefined) return false;
	return !source.includes("node_modules") && (source.startsWith(".") || source.startsWith("/"));
}

export function shouldCheckImport(option: ImportCheckOption, definition: Definition): boolean {
	if (option === false) return false;
	return option === "internal" ? isInternalImport(definition) : true;
}

export function isClassVariable(variable: Variable): boolean {
	if (variable.defs.length !== 1) return false;
	return variable.defs[0]?.type === "ClassName";
}
