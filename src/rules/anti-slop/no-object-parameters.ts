// Vendored from src/rules/no-object-parameters.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to the local createRule API and path aliases; uses
// repository AST guards, shared function-parameter parsing with range-trimmed
// binding names, and the shared iterative lexical alias resolver.

import {
	getFunctionParameterBindingName,
	getFunctionParameterTypeAnnotation,
} from "$oxc-utilities/anti-slop/function-parameters";
import { createTypeAliasEnvironment, resolvedTypeMatches } from "$oxc-utilities/anti-slop/type-alias-resolution";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isTsObjectKeyword,
	isTsParenthesizedType,
	isTsTypeAnnotation,
	isTsUnionType,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

import type { TypeAliasEnvironment } from "$oxc-utilities/anti-slop/type-alias-resolution";

type ParameterOwner =
	| ESTree.ArrowFunctionExpression
	| ESTree.Function
	| ESTree.TSCallSignatureDeclaration
	| ESTree.TSConstructorType
	| ESTree.TSConstructSignatureDeclaration
	| ESTree.TSFunctionType
	| ESTree.TSMethodSignature;
const noObjectParameters = createRule("no-object-parameters", "anti-slop", {
	createOnce(context): Visitor {
		let environment: TypeAliasEnvironment;

		function resolvesToObject(type: ESTree.TSType): boolean {
			return resolvedTypeMatches(type, environment, (resolved, enqueue) => {
				if (isTsObjectKeyword(resolved)) return true;
				if (isTsParenthesizedType(resolved)) {
					enqueue(resolved.typeAnnotation);
					return false;
				}
				if (isTsUnionType(resolved)) {
					for (const member of resolved.types) enqueue(member);
				}
				return false;
			});
		}

		function checkParameters(node: ParameterOwner): void {
			for (const parameter of node.params) {
				const annotation = getFunctionParameterTypeAnnotation(parameter);
				if (!isTsTypeAnnotation(annotation) || !resolvesToObject(annotation.typeAnnotation)) {
					continue;
				}
				context.report({
					data: {
						parameter: getFunctionParameterBindingName(parameter, context.sourceCode),
					},
					messageId: "objectParameter",
					node: annotation.typeAnnotation,
				});
			}
		}

		return {
			ArrowFunctionExpression: checkParameters,
			FunctionDeclaration: checkParameters,
			FunctionExpression: checkParameters,
			Program(node): void {
				environment = createTypeAliasEnvironment(node, context.sourceCode.visitorKeys);
			},
			TSCallSignatureDeclaration: checkParameters,
			TSConstructorType: checkParameters,
			TSConstructSignatureDeclaration: checkParameters,
			TSDeclareFunction: checkParameters,
			TSEmptyBodyFunctionExpression: checkParameters,
			TSFunctionType: checkParameters,
			TSMethodSignature: checkParameters,
		};
	},
	meta: {
		docs: {
			description:
				"Disallow object function parameters; inputs must use an owner-provided type and be parsed at their boundary.",
			recommended: true,
		},
		messages: {
			objectParameter:
				"Parameter `{{parameter}}` uses the broad `object` type. Accept a named owner type; parse external input at its boundary before calling this function.",
		},
		type: "problem",
	},
});

export default noObjectParameters;
