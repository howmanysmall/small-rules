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
	isTsQualifiedName,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";
import { isObjectPropertyKey } from "$oxc-utilities/prevent-abbreviations/scope";

import type { Definition, ESTree, SourceCode } from "oxlint-plugin-utilities";

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
	if (typeName.type === "Identifier") return typeName;
	/* v8 ignore next -- @preserve parser-produced TSTypeReference names are identifiers or qualified names. */
	if (typeName.type === "TSQualifiedName") return getRootTypeName(typeName.left);
	/* v8 ignore next -- @preserve TSTypeReference cannot use a this expression as its type name in parsed source. */
	return undefined;
}

function isExternalType(typeAnnotation: ESTree.TSType, sourceCode: SourceCode): boolean {
	if (typeAnnotation.type === "TSImportType") return isExternalModuleSpecifier(typeAnnotation.source.value);
	if (typeAnnotation.type !== "TSTypeReference") return false;

	const rootTypeName = getRootTypeName(typeAnnotation.typeName);
	/* v8 ignore next -- @preserve parsed TSTypeReference names always resolve to an identifier root. */
	if (rootTypeName === undefined) return false;

	const definition = getVariableByName(sourceCode.getScope(rootTypeName), rootTypeName.name)?.defs[0];
	return isExternalPackageImport(definition);
}

function getContextualType(objectExpression: ESTree.ObjectExpression): ESTree.TSType | undefined {
	const { parent } = objectExpression;
	if (isVariableDeclarator(parent) && parent.init === objectExpression) {
		return getTypeAnnotationFromBinding(parent.id)?.typeAnnotation;
	}
	if (
		(parent.type === "TSAsExpression" ||
			parent.type === "TSSatisfiesExpression" ||
			parent.type === "TSTypeAssertion") &&
		parent.expression === objectExpression
	) {
		return parent.typeAnnotation;
	}
	return undefined;
}

function isImportedObjectPropertyAccess(node: ESTree.IdentifierName, sourceCode: SourceCode): boolean {
	const { parent } = node;

	let objectNode: ESTree.Node | undefined;
	/* v8 ignore else -- callers limit this to member or TS-qualified property access. @preserve */
	if (isMemberExpression(parent) && parent.property === node && !parent.computed) {
		objectNode = parent.object;
	} else if (isTsQualifiedName(parent) && parent.right === node) objectNode = parent.left;

	if (objectNode === undefined || !hasName(objectNode)) return false;

	return getVariableByName(sourceCode.getScope(node), objectNode.name)?.defs[0]?.type === "ImportBinding";
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
