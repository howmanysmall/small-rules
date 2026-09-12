// Vendored from src/rules/no-unknown-returns.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to the local createRule API and path aliases; uses
// repository AST guards and the shared iterative lexical alias resolver; and
// only unwraps unshadowed built-in Promise and PromiseLike references.

import {
	createTypeAliasEnvironment,
	hasVisibleTypeBinding,
	resolvedTypeMatches,
} from "$oxc-utilities/anti-slop/type-alias-resolution";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isBindingIdentifier,
	isTsParenthesizedType,
	isTsTypeReference,
	isTsUnionType,
	isTsUnknownKeyword,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

import type { TypeAliasEnvironment } from "$oxc-utilities/anti-slop/type-alias-resolution";

type FunctionWithReturnType =
	| ESTree.ArrowFunctionExpression
	| ESTree.Function
	| ESTree.TSCallSignatureDeclaration
	| ESTree.TSConstructorType
	| ESTree.TSConstructSignatureDeclaration
	| ESTree.TSFunctionType
	| ESTree.TSMethodSignature;

function isIdentifierTypeReference(
	type: ESTree.TSType,
): type is ESTree.TSTypeReference & { typeName: ESTree.BindingIdentifier } {
	return isTsTypeReference(type) && isBindingIdentifier(type.typeName);
}

function isPromiseLikeName(name: string): boolean {
	return name === "Promise" || name === "PromiseLike";
}

function enqueueWrappedType(resolved: ESTree.TSType, enqueue: (child: ESTree.TSType) => void): boolean {
	if (isTsParenthesizedType(resolved)) {
		enqueue(resolved.typeAnnotation);
		return true;
	}
	if (isTsUnionType(resolved)) {
		for (const member of resolved.types) enqueue(member);
		return true;
	}
	return false;
}

function isUnshadowedPromiseReference(
	type: ESTree.TSType,
	environment: TypeAliasEnvironment,
): type is ESTree.TSTypeReference & { typeName: ESTree.BindingIdentifier } {
	if (!isIdentifierTypeReference(type) || !isPromiseLikeName(type.typeName.name)) return false;
	return !hasVisibleTypeBinding(type.typeName.name, type, environment);
}

function enqueuePromiseValue(
	resolved: ESTree.TSTypeReference & { typeName: ESTree.BindingIdentifier },
	enqueue: (child: ESTree.TSType) => void,
): void {
	const value = resolved.typeArguments?.params[0];
	if (value !== undefined) enqueue(value);
}

const noUnknownReturns = createRule("no-unknown-returns", "anti-slop", {
	createOnce(context): Visitor {
		let environment: TypeAliasEnvironment;

		function resolvesToUnknown(type: ESTree.TSType): boolean {
			return resolvedTypeMatches(type, environment, (resolved, enqueue) => {
				if (isTsUnknownKeyword(resolved)) return true;
				if (enqueueWrappedType(resolved, enqueue)) return false;
				if (!isUnshadowedPromiseReference(resolved, environment)) return false;

				enqueuePromiseValue(resolved, enqueue);
				return false;
			});
		}

		function checkReturnType(node: FunctionWithReturnType): void {
			const annotation = node.returnType;
			if (!annotation) return;

			if (!resolvesToUnknown(annotation.typeAnnotation)) return;

			context.report({ messageId: "unknownReturn", node: annotation.typeAnnotation });
		}

		return {
			ArrowFunctionExpression: checkReturnType,
			FunctionDeclaration: checkReturnType,
			FunctionExpression: checkReturnType,
			Program(node): void {
				environment = createTypeAliasEnvironment(node, context.sourceCode.visitorKeys);
			},
			TSCallSignatureDeclaration: checkReturnType,
			TSConstructorType: checkReturnType,
			TSConstructSignatureDeclaration: checkReturnType,
			TSDeclareFunction: checkReturnType,
			TSEmptyBodyFunctionExpression: checkReturnType,
			TSFunctionType: checkReturnType,
			TSMethodSignature: checkReturnType,
		};
	},
	meta: {
		docs: {
			description: "Disallow functions whose explicit return contract is unknown or Promise<unknown>.",
			recommended: true,
		},
		messages: {
			unknownReturn:
				"This function exposes `unknown` to its caller. Parse the value at its boundary and return a named domain type.",
		},
		type: "problem",
	},
});

export default noUnknownReturns;
