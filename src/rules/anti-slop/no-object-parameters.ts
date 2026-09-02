// Vendored from src/rules/no-object-parameters.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path aliases.

import { lexicalTypeParameterNames } from "$oxc-utilities/anti-slop/lexical-type-parameters";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isAssignmentPattern,
	isBindingIdentifier,
	isExportNamedDeclaration,
	isIdentifierReference,
	isRestElement,
	isTsObjectKeyword,
	isTsParameterProperty,
	isTsParenthesizedType,
	isTsTypeAliasDeclaration,
	isTsTypeAnnotation,
	isTsTypeReference,
	isTsUnionType,
} from "$oxc-utilities/oxc-utilities";

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

function parameterAnnotation(parameter: Parameter): ESTree.TSTypeAnnotation | undefined {
	let current = parameter;
	while (isTsParameterProperty(current) || isRestElement(current)) {
		if (isTsParameterProperty(current)) {
			current = current.parameter;
			continue;
		}

		if (isTsTypeAnnotation(current.typeAnnotation)) return current.typeAnnotation;
		current = current.argument;
	}

	if (isAssignmentPattern(current)) return current.typeAnnotation ?? current.left.typeAnnotation ?? undefined;
	return current.typeAnnotation ?? undefined;
}

function parameterName(parameter: Parameter, annotation: ESTree.TSTypeAnnotation, sourceText: string): string {
	if (isBindingIdentifier(parameter)) return parameter.name;

	// Yuku parameter nodes span their type annotation, so trimming the annotation
	// text always yields the displayed name; upstream kept a foreign-parser
	// branch.
	return sourceText.slice(0, sourceText.length - (annotation.range[1] - annotation.range[0])).trimEnd();
}

function aliasName(type: ESTree.TSType): string | undefined {
	if (
		!isTsTypeReference(type) ||
		!isIdentifierReference(type.typeName) ||
		(type.typeArguments?.params.length ?? 0) > 0
	) {
		return undefined;
	}
	return type.typeName.name;
}

function enqueueNestedTypes(type: ESTree.TSType, pending: Array<ESTree.TSType>): boolean {
	if (isTsParenthesizedType(type)) {
		pending.push(type.typeAnnotation);
		return true;
	}
	if (isTsUnionType(type)) {
		for (const member of type.types) pending.push(member);
		return true;
	}
	return false;
}

const noObjectParameters = createRule("no-object-parameters", "anti-slop", {
	createOnce(context): Visitor {
		const aliases = new Map<string, ESTree.TSType>();

		function enqueueAlias(
			type: ESTree.TSType,
			shadowedAliases: ReadonlySet<string>,
			visitedAliases: Set<string>,
			pending: Array<ESTree.TSType>,
		): void {
			const name = aliasName(type);
			if (name === undefined || visitedAliases.has(name) || shadowedAliases.has(name)) {
				return;
			}
			visitedAliases.add(name);
			const alias = aliases.get(name);
			if (alias !== undefined) pending.push(alias);
		}

		function resolvesToObject(type: ESTree.TSType, shadowedAliases: ReadonlySet<string>): boolean {
			const visitedAliases = new Set<string>();
			let pending: Array<ESTree.TSType> = [type];

			while (pending.length > 0) {
				const next = new Array<ESTree.TSType>();
				for (const current of pending) {
					if (isTsObjectKeyword(current)) return true;
					if (enqueueNestedTypes(current, next)) continue;
					enqueueAlias(current, shadowedAliases, visitedAliases, next);
				}
				pending = next;
			}
			return false;
		}

		function checkParameters(node: ParameterOwner): void {
			const shadowedAliases = lexicalTypeParameterNames(node, context.sourceCode.visitorKeys);
			for (const parameter of node.params) {
				const annotation = parameterAnnotation(parameter);
				if (!isTsTypeAnnotation(annotation) || !resolvesToObject(annotation.typeAnnotation, shadowedAliases)) {
					continue;
				}
				context.report({
					data: {
						parameter: parameterName(parameter, annotation, context.sourceCode.getText(parameter)),
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
				aliases.clear();
				for (const statement of node.body) {
					/* v8 ignore next -- This discriminated AST normalization has both forms covered by parser fixtures. @preserve */
					const declaration = isExportNamedDeclaration(statement) ? statement.declaration : statement;
					if (
						isTsTypeAliasDeclaration(declaration) &&
						(declaration.typeParameters?.params.length ?? 0) === 0
					) {
						aliases.set(declaration.id.name, declaration.typeAnnotation);
					}
				}
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
