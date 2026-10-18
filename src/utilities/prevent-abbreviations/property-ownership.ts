import {
	hasName,
	isCallExpression,
	isIdentifier,
	isMemberExpression,
	isObjectExpression,
	isTsAsExpression,
	isTsQualifiedName,
	isTsSatisfiesExpression,
	isTsTypeAssertion,
	isVariableDeclarator,
} from "@small-rules/oxlint-utilities";

import {
	getVariableByName,
	isExternalPackageImport,
	isExternalType,
	resolveRootObjectIdentifier,
} from "$oxc-utilities/ast-utilities";
import { getTypeAnnotationFromBinding } from "$oxc-utilities/oxc-utilities";
import { isObjectPropertyKey } from "$oxc-utilities/prevent-abbreviations/scope";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

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

function isImportedObjectPropertyAccess(node: ESTree.IdentifierName, sourceCode: SourceCode): boolean {
	const { parent } = node;

	let objectNode: ESTree.Node | undefined;
	/* v8 ignore else -- callers limit this to member or TS-qualified property access. @preserve */
	if (isMemberExpression(parent) && parent.property === node && !parent.computed) {
		objectNode = parent.object;
	} else if (isTsQualifiedName(parent) && parent.right === node) objectNode = parent.left;

	if (objectNode === undefined) return false;

	const rootNode = isIdentifier(objectNode) ? objectNode : resolveRootObjectIdentifier(objectNode);
	if (rootNode === undefined || !hasName(rootNode)) return false;

	return getVariableByName(sourceCode.getScope(node), rootNode.name)?.defs[0]?.type === "ImportBinding";
}

function isExternalCallProperty(objectExpression: ESTree.ObjectExpression, sourceCode: SourceCode): boolean {
	const callExpression = objectExpression.parent;
	if (!isCallExpression(callExpression)) return false;

	const { callee } = callExpression;
	if (!isIdentifier(callee)) return false;

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
