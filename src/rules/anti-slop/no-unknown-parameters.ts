// Vendored from src/rules/no-unknown-parameters.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: local API and path alias adaptation.

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

type Parameter = ESTree.ParamPattern;
type ParameterOwner =
	| ESTree.ArrowFunctionExpression
	| ESTree.Function
	| ESTree.TSCallSignatureDeclaration
	| ESTree.TSConstructorType
	| ESTree.TSConstructSignatureDeclaration
	| ESTree.TSFunctionType
	| ESTree.TSMethodSignature;
interface TypeAnnotatedParameter {
	readonly typeAnnotation?: ESTree.TSTypeAnnotation | null;
}

function annotationOf(parameter: TypeAnnotatedParameter): ESTree.TSTypeAnnotation | undefined {
	return parameter.typeAnnotation ?? undefined;
}

function parameterAnnotation(parameter: Parameter): ESTree.TSTypeAnnotation | undefined {
	let current = parameter;
	while (true) {
		if (current.type === "TSParameterProperty") {
			current = current.parameter;
			continue;
		}
		if (current.type === "RestElement") {
			if (current.typeAnnotation) return current.typeAnnotation;
			current = current.argument;
			continue;
		}
		if (current.type === "AssignmentPattern") {
			current = current.left;
			continue;
		}
		return annotationOf(current);
	}
}

function parameterName(parameter: Parameter, sourceText: string): string {
	let current = parameter;
	while (true) {
		if (current.type === "TSParameterProperty") {
			current = current.parameter;
			continue;
		}
		if (current.type === "AssignmentPattern") {
			current = current.left;
			continue;
		}
		if (current.type === "RestElement") {
			current = current.argument;
			continue;
		}
		return current.type === "Identifier" ? current.name : sourceText.split(": unknown").join("").trim();
	}
}

const noUnknownParameters = createRule("no-unknown-parameters", "anti-slop", {
	createOnce(context): Visitor {
		function checkParameters(node: ParameterOwner): void {
			for (const parameter of node.params) {
				const annotation = parameterAnnotation(parameter);
				if (annotation?.typeAnnotation.type !== "TSUnknownKeyword") continue;

				const name = parameterName(parameter, context.sourceCode.getText(parameter));
				if (name === "cause") continue;

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
				"Disallow explicitly unknown function parameters except `cause`; decode unknown input at its I/O boundary instead.",
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
