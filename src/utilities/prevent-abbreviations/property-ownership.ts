import { getVariableByName } from "$oxc-utilities/ast-utilities";
import {
	getTypeAnnotationFromBinding,
	hasName,
	isCallExpression,
	isIdentifierName,
	isImportDeclaration,
	isMemberExpression,
	isObjectExpression,
	isStringLiteral,
	isTsAsExpression,
	isTsImportType,
	isTsIndexedAccessType,
	isTsInterfaceDeclaration,
	isTsIntersectionType,
	isTsQualifiedName,
	isTsSatisfiesExpression,
	isTsTypeAliasDeclaration,
	isTsTypeAssertion,
	isTsTypeReference,
	isTsUnionType,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";
import { isObjectPropertyKey } from "$oxc-utilities/prevent-abbreviations/scope";

import type { Definition, ESTree, Scope, SourceCode } from "oxlint-plugin-utilities";

const NON_PACKAGE_IMPORT_PATTERN = /^(?:[#$./]|[~@]\/)/u;

function isExternalModuleSpecifier(specifier: string): boolean {
	return !NON_PACKAGE_IMPORT_PATTERN.test(specifier);
}

function isExternalPackageImport(definition: Definition | undefined): boolean {
	if (definition?.type !== "ImportBinding") return false;

	const { parent } = definition;
	/* v8 ignore next -- @preserve parser import bindings retain their ImportDeclaration parent. */
	if (parent === null || !isImportDeclaration(parent) || !isStringLiteral(parent.source)) return false;

	return isExternalModuleSpecifier(parent.source.value);
}

function getRootTypeName(typeName: ESTree.TSTypeName): ESTree.IdentifierReference | undefined {
	let current = typeName;
	while (isTsQualifiedName(current)) current = current.left;
	/* v8 ignore next -- @preserve TSTypeReference cannot use a this expression as its type name in parsed source. */
	return isIdentifierName(current) ? current : undefined;
}

function isExternalType(typeAnnotation: ESTree.TSType, sourceCode: SourceCode): boolean {
	return isExternalTypeNode(typeAnnotation, sourceCode, new Set<object>());
}

function isExternalTypeNode(
	typeAnnotation: ESTree.TSType,
	sourceCode: SourceCode,
	visitedDeclarations: Set<object>,
): boolean {
	let current = typeAnnotation;
	while (isTsIndexedAccessType(current)) current = current.objectType;

	if (isTsImportType(current)) return isExternalModuleSpecifier(current.source.value);
	if (isTsTypeReference(current)) {
		const rootTypeName = getRootTypeName(current.typeName);
		/* v8 ignore next -- @preserve parsed TSTypeReference names always resolve to an identifier root. */
		if (rootTypeName === undefined) return false;

		return isExternalNamedType(
			rootTypeName.name,
			sourceCode.getScope(rootTypeName),
			current.typeArguments,
			sourceCode,
			visitedDeclarations,
		);
	}
	if (isTsUnionType(current) || isTsIntersectionType(current)) {
		return current.types.some((member) => isExternalTypeNode(member, sourceCode, visitedDeclarations));
	}

	return false;
}

function isExternalNamedType(
	name: string,
	scope: null | Scope,
	typeArguments: ESTree.TSTypeParameterInstantiation | null,
	sourceCode: SourceCode,
	visitedDeclarations: Set<object>,
): boolean {
	const definition = getVariableByName(scope, name)?.defs[0];
	if (isExternalPackageImport(definition)) return true;

	if (definition === undefined) {
		if (typeArguments === null) return false;
		return typeArguments.params.some((parameter) => isExternalTypeNode(parameter, sourceCode, visitedDeclarations));
	}

	const declaration = definition.node;
	if (isTsTypeAliasDeclaration(declaration)) {
		if (visitedDeclarations.has(declaration)) return false;
		visitedDeclarations.add(declaration);
		return isExternalTypeNode(declaration.typeAnnotation, sourceCode, visitedDeclarations);
	}
	if (isTsInterfaceDeclaration(declaration)) {
		return declaration.extends.some((heritage) =>
			isExternalInterfaceHeritage(heritage, sourceCode, visitedDeclarations),
		);
	}

	return false;
}

function isExternalInterfaceHeritage(
	heritage: ESTree.TSInterfaceHeritage,
	sourceCode: SourceCode,
	visitedDeclarations: Set<object>,
): boolean {
	const rootNode = resolveRootObjectIdentifier(heritage.expression);
	/* v8 ignore next -- @preserve parsed heritage roots resolve to named identifiers or import types. */
	if (rootNode === undefined || !hasName(rootNode)) return false;

	return isExternalNamedType(
		rootNode.name,
		sourceCode.getScope(rootNode),
		heritage.typeArguments,
		sourceCode,
		visitedDeclarations,
	);
}

function getContextualType(objectExpression: ESTree.ObjectExpression): ESTree.TSType | undefined {
	const { parent } = objectExpression;
	if (isVariableDeclarator(parent) && parent.init === objectExpression) {
		return getTypeAnnotationFromBinding(parent.id)?.typeAnnotation;
	}
	if (
		(isTsAsExpression(parent) || isTsSatisfiesExpression(parent) || isTsTypeAssertion(parent)) &&
		parent.expression === objectExpression
	) {
		return parent.typeAnnotation;
	}
	return undefined;
}

function resolveRootObjectIdentifier(node: ESTree.Node): ESTree.Node | undefined {
	let current = node;
	while (true) {
		if (isIdentifierName(current)) return current;
		if (isMemberExpression(current)) {
			current = current.object;
			continue;
		}
		if (isTsQualifiedName(current)) {
			current = current.left;
			continue;
		}
		return undefined;
	}
}

function isImportedObjectPropertyAccess(node: ESTree.IdentifierName, sourceCode: SourceCode): boolean {
	const { parent } = node;

	let objectNode: ESTree.Node | undefined;
	/* v8 ignore else -- callers limit this to member or TS-qualified property access. @preserve */
	if (isMemberExpression(parent) && parent.property === node && !parent.computed) {
		objectNode = parent.object;
	} else if (isTsQualifiedName(parent) && parent.right === node) objectNode = parent.left;

	if (objectNode === undefined) return false;

	const rootNode = isIdentifierName(objectNode) ? objectNode : resolveRootObjectIdentifier(objectNode);
	if (rootNode === undefined || !hasName(rootNode)) return false;

	return getVariableByName(sourceCode.getScope(node), rootNode.name)?.defs[0]?.type === "ImportBinding";
}

function isExternalCallProperty(objectExpression: ESTree.ObjectExpression, sourceCode: SourceCode): boolean {
	const callExpression = objectExpression.parent;
	if (!isCallExpression(callExpression)) return false;

	const { callee } = callExpression;
	if (!isIdentifierName(callee)) return false;

	const definition = getVariableByName(sourceCode.getScope(callee), callee.name)?.defs[0];
	return isExternalPackageImport(definition);
}

export function isExternallyControlledProperty(node: ESTree.IdentifierName, sourceCode: SourceCode): boolean {
	if (isImportedObjectPropertyAccess(node, sourceCode)) return true;
	if (!isObjectPropertyKey(node)) return false;

	const objectExpression = node.parent.parent;
	if (objectExpression === null || !isObjectExpression(objectExpression)) return false;

	const contextualType = getContextualType(objectExpression);
	return (
		(contextualType !== undefined && isExternalType(contextualType, sourceCode)) ||
		isExternalCallProperty(objectExpression, sourceCode)
	);
}
