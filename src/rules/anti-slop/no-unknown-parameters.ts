// Vendored from src/rules/no-unknown-parameters.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases. The single parameter named by an explicit type predicate or
// assertion predicate return type is allowed. Union and parenthesized unknown
// detection is provided by the shared function-parameters helper.

import {
	containsUnknownType,
	functionParameterBindingName,
	functionParameterTypeAnnotation,
} from "$oxc-utilities/anti-slop/function-parameters";
import { createRule } from "$oxc-utilities/create-rule";
import { isBindingIdentifier, isTsTypeAnnotation, isTsTypePredicate } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

type ParameterOwner =
	| ESTree.ArrowFunctionExpression
	| ESTree.Function
	| ESTree.TSCallSignatureDeclaration
	| ESTree.TSConstructorType
	| ESTree.TSConstructSignatureDeclaration
	| ESTree.TSFunctionType
	| ESTree.TSMethodSignature;

/**
 * The parameter that an explicit type predicate or assertion predicate
 * validates.
 *
 * @param node - Function-like node whose return type may contain a predicate.
 * @returns The predicate's parameter name, if it names one.
 */
function validatedParameterName(node: ParameterOwner): string | undefined {
	const predicate = node.returnType?.typeAnnotation;
	if (!isTsTypePredicate(predicate)) return undefined;
	/* v8 ignore next -- `this`-based predicates do not name a parameter. @preserve */
	return isBindingIdentifier(predicate.parameterName) ? predicate.parameterName.name : undefined;
}

const noUnknownParameters = createRule("no-unknown-parameters", "anti-slop", {
	createOnce(context): Visitor {
		function checkParameters(node: ParameterOwner): void {
			const validatedName = validatedParameterName(node);
			for (const parameter of node.params) {
				const annotation = functionParameterTypeAnnotation(parameter);
				if (!isTsTypeAnnotation(annotation)) continue;
				if (!containsUnknownType(annotation.typeAnnotation)) continue;

				const name = functionParameterBindingName(parameter, context.sourceCode);
				if (name === "cause" || name === validatedName) continue;

				context.report({
					data: { parameter: name },
					messageId: "unknownParameter",
					node: annotation.typeAnnotation,
				});
			}
		}

		return {
			ArrowFunctionExpression: checkParameters,
			FunctionDeclaration: checkParameters,
			FunctionExpression: checkParameters,
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
				"Disallow explicitly unknown function parameters except `cause` and the parameter named by a type predicate; decode unknown input at its I/O boundary instead.",
			recommended: true,
		},
		messages: {
			unknownParameter:
				"Parameter `{{parameter}}` leaves input unparsed. Accept a named domain type; run the expected schema or parser at the I/O boundary before calling this function.",
		},
		type: "problem",
	},
});

export default noUnknownParameters;
