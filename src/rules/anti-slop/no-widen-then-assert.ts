// Vendored from src/rules/no-widen-then-assert.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases; variable resolution uses the shared getVariableByName helper
// instead of upstream's scope-manager reference scan.

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	ARROW_FUNCTION_EXPRESSION,
	FUNCTION_DECLARATION,
	FUNCTION_EXPRESSION,
	isAnyLiteral,
	isArrayExpression,
	isArrowFunctionExpression,
	isBindingIdentifier,
	isClassExpression,
	isFunctionExpression,
	isNewExpression,
	isObjectExpression,
	isProgram,
	isTemplateLiteral,
	isTsAnyKeyword,
	isTsAsExpression,
	isTsIndexSignature,
	isTsNumberKeyword,
	isTsObjectKeyword,
	isTsStringKeyword,
	isTsSymbolKeyword,
	isTsTypeAssertion,
	isTsTypeLiteral,
	isTsTypeReference,
	isTsUnionType,
	isTsUnknownKeyword,
	isVariableDeclaration,
	isVariableDeclarator,
	TS_ARRAY_TYPE,
	TS_CONSTRUCTOR_TYPE,
	TS_DECLARE_FUNCTION,
	TS_EMPTY_BODY_FUNCTION_EXPRESSION,
	TS_FUNCTION_TYPE,
	TS_INTERSECTION_TYPE,
	TS_MAPPED_TYPE,
	TS_OBJECT_KEYWORD,
	TS_TUPLE_TYPE,
	TS_TYPE_LITERAL,
	TS_TYPE_OPERATOR,
	unwrapParenthesis,
	unwrapParenthesizedType,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";
import type { Except } from "type-fest";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

type BroadTypeKind = "object" | "record" | "top";

type Parameter = ESTree.ParamPattern;

interface KnownValueEvidence {
	readonly type: ESTree.TSType | undefined;
}

const FUNCTION_BOUNDARY_TYPES = new Set([
	ARROW_FUNCTION_EXPRESSION,
	FUNCTION_DECLARATION,
	FUNCTION_EXPRESSION,
	TS_DECLARE_FUNCTION,
	TS_EMPTY_BODY_FUNCTION_EXPRESSION,
]);

interface WidenedBinding {
	readonly boundary: ESTree.Node | undefined;
	readonly broadKind: BroadTypeKind;
	readonly declaredAt: number;
	readonly evidence: KnownValueEvidence;
}

function getTypeReferenceName(type: ESTree.TSTypeReference): string | undefined {
	return isBindingIdentifier(type.typeName) ? type.typeName.name : undefined;
}

function isUnknownOrAnyType(type: ESTree.TSType): boolean {
	const unwrapped = unwrapParenthesizedType(type);
	return isTsAnyKeyword(unwrapped) || isTsUnknownKeyword(unwrapped);
}

function isBroadRecordKeyType(type: ESTree.TSType): boolean {
	const unwrapped = unwrapParenthesizedType(type);
	if (isTsNumberKeyword(unwrapped) || isTsStringKeyword(unwrapped) || isTsSymbolKeyword(unwrapped)) return true;
	if (isTsUnionType(unwrapped)) return unwrapped.types.every(isBroadRecordKeyType);
	return isTsTypeReference(unwrapped) && getTypeReferenceName(unwrapped) === "PropertyKey";
}

function isBroadRecordType(type: ESTree.TSType): boolean {
	const unwrapped = unwrapParenthesizedType(type);

	if (isTsTypeReference(unwrapped)) {
		if (getTypeReferenceName(unwrapped) === "Readonly") {
			/* v8 ignore next 2 -- A bare Readonly type is parser-valid but has no meaningful assertion contract. @preserve */
			const [inner] = unwrapped.typeArguments?.params ?? [];
			return inner !== undefined && isBroadRecordType(inner);
		}

		if (getTypeReferenceName(unwrapped) !== "Record") return false;
		/* v8 ignore next 7 -- Arity-mismatched Record forms are parser-valid but cannot be narrower records. @preserve */
		const parameters = unwrapped.typeArguments?.params ?? [];
		return (
			parameters.length === 2 &&
			parameters[0] !== undefined &&
			parameters[1] !== undefined &&
			isBroadRecordKeyType(parameters[0]) &&
			isUnknownOrAnyType(parameters[1])
		);
	}

	if (!isTsTypeLiteral(unwrapped) || unwrapped.members.length !== 1) return false;

	const [member] = unwrapped.members;
	if (!isTsIndexSignature(member) || member.parameters.length !== 1) return false;

	const [parameter] = member.parameters;
	return (
		parameter !== undefined &&
		isBroadRecordKeyType(parameter.typeAnnotation.typeAnnotation) &&
		isUnknownOrAnyType(member.typeAnnotation.typeAnnotation)
	);
}

function getBroadTypeKind(type: ESTree.TSType): BroadTypeKind | undefined {
	const unwrapped = unwrapParenthesizedType(type);
	if (isTsAnyKeyword(unwrapped) || isTsUnknownKeyword(unwrapped)) return "top";
	if (isTsObjectKeyword(unwrapped)) return "object";
	return isBroadRecordType(unwrapped) ? "record" : undefined;
}

function assertedExpression(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): ESTree.Expression {
	return unwrapParenthesis(node.expression);
}

function assertionFromExpression(
	expression: ESTree.Expression,
): ESTree.TSAsExpression | ESTree.TSTypeAssertion | undefined {
	const unwrapped = unwrapParenthesis(expression);
	return isTsAsExpression(unwrapped) || isTsTypeAssertion(unwrapped) ? unwrapped : undefined;
}

function normalizedTypeText(sourceText: string, type: ESTree.TSType): string {
	return sourceText.slice(type.range[0], type.range[1]).replaceAll(/\s+/gu, "");
}

function typesHaveSameSyntax(sourceText: string, left: ESTree.TSType | undefined, right: ESTree.TSType): boolean {
	return (
		left !== undefined &&
		normalizedTypeText(sourceText, unwrapParenthesizedType(left)) ===
			normalizedTypeText(sourceText, unwrapParenthesizedType(right))
	);
}

function isDefinitelyObjectType(type: ESTree.TSType): boolean {
	const unwrapped = unwrapParenthesizedType(type);
	switch (unwrapped.type) {
		case TS_ARRAY_TYPE:
		case TS_CONSTRUCTOR_TYPE:
		case TS_FUNCTION_TYPE:
		case TS_MAPPED_TYPE:
		case TS_OBJECT_KEYWORD:
		case TS_TUPLE_TYPE:
			return true;

		case TS_INTERSECTION_TYPE:
			return unwrapped.types.every(isDefinitelyObjectType);

		case TS_TYPE_LITERAL:
			return unwrapped.members.length > 0;

		case TS_TYPE_OPERATOR:
			return unwrapped.operator === "readonly" && isDefinitelyObjectType(unwrapped.typeAnnotation);

		default:
			return false;
	}
}

function isDefinitelyNarrowerRecordType(type: ESTree.TSType): boolean {
	const unwrapped = unwrapParenthesizedType(type);
	if (isTsTypeLiteral(unwrapped)) return unwrapped.members.some((member) => !isTsIndexSignature(member));
	if (!isTsTypeReference(unwrapped)) return false;

	if (getTypeReferenceName(unwrapped) === "Readonly") {
		const [inner] = unwrapped.typeArguments?.params ?? [];
		return inner !== undefined && isDefinitelyNarrowerRecordType(inner);
	}
	if (getTypeReferenceName(unwrapped) !== "Record") return false;

	const parameters = unwrapped.typeArguments?.params ?? [];
	return parameters.length === 2 && parameters[1] !== undefined && !isUnknownOrAnyType(parameters[1]);
}

function getFunctionBoundary(node: ESTree.Node): ESTree.Node | undefined {
	/* v8 ignore next -- Rule visitors never request a boundary for the Program root. @preserve */
	let current = node.parent ?? undefined;
	while (current !== undefined && !isProgram(current)) {
		if (FUNCTION_BOUNDARY_TYPES.has(current.type)) return current;
		current = current.parent;
	}
	return undefined;
}

function resolveVariable(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): ScopeVariable | undefined {
	return getVariableByName(sourceCode.getScope(identifier), identifier.name);
}

function variableDeclarator(variable: ScopeVariable): ESTree.VariableDeclarator | undefined {
	for (const definition of variable.defs) {
		if (definition.type === "Variable" && isVariableDeclarator(definition.node)) return definition.node;
	}
	return undefined;
}

function hasUninitializedWrite(variable: ScopeVariable): boolean {
	/* v8 ignore next -- Const bindings cannot receive an uninitialized write in valid TypeScript. @preserve */
	return variable.references.some((reference) => reference.isWrite() && !reference.init);
}

interface MaybeAnnotated {
	readonly typeAnnotation?: ESTree.TSTypeAnnotation | null;
}

function annotationOfType(node: MaybeAnnotated): ESTree.TSTypeAnnotation | undefined {
	return node.typeAnnotation ?? undefined;
}

function directKnownValueEvidence(expression: ESTree.Expression): KnownValueEvidence | undefined {
	const unwrapped = unwrapParenthesis(expression);
	if (isTsAsExpression(unwrapped) || isTsTypeAssertion(unwrapped)) {
		/* v8 ignore next -- The broad-assertion path is retained for malformed/intermediate ASTs. @preserve */
		if (getBroadTypeKind(unwrapped.typeAnnotation) !== undefined) return undefined;
		return { type: unwrapped.typeAnnotation };
	}

	return isAnyLiteral(unwrapped) ||
		isTemplateLiteral(unwrapped) ||
		isArrayExpression(unwrapped) ||
		isArrowFunctionExpression(unwrapped) ||
		isClassExpression(unwrapped) ||
		isFunctionExpression(unwrapped) ||
		isNewExpression(unwrapped) ||
		isObjectExpression(unwrapped)
		? { type: undefined }
		: undefined;
}

function knownAnnotationEvidence(
	identifier: ScopeVariable["identifiers"][number],
	boundary?: ESTree.Node,
): KnownValueEvidence | undefined {
	const annotation = identifier.typeAnnotation?.typeAnnotation;
	/* v8 ignore next -- Callers select only identifiers with an annotation. @preserve */
	if (annotation === undefined) return undefined;
	if (getFunctionBoundary(identifier) !== boundary || getBroadTypeKind(annotation) !== undefined) return undefined;
	return { type: annotation };
}

function getKnownInitializer(variable: ScopeVariable, boundary?: ESTree.Node): ESTree.Expression | undefined {
	const declarator = variableDeclarator(variable);
	if (declarator === undefined) return undefined;

	if (
		!isVariableDeclaration(declarator.parent) ||
		declarator.parent.kind !== "const" ||
		declarator.init === null ||
		hasUninitializedWrite(variable) ||
		getFunctionBoundary(declarator) !== boundary
	) {
		return undefined;
	}
	return declarator.init;
}

function knownValueEvidence(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	boundary: ESTree.Node | undefined,
	visitedVariables: ReadonlySet<ScopeVariable>,
): KnownValueEvidence | undefined {
	let currentExpression = expression;
	const seenVariables = new Set(visitedVariables);
	for (;;) {
		const directEvidence = directKnownValueEvidence(currentExpression);
		if (directEvidence !== undefined) return directEvidence;

		const unwrapped = unwrapParenthesis(currentExpression);
		if (!isBindingIdentifier(unwrapped)) return undefined;

		const variable = resolveVariable(sourceCode, unwrapped);
		if (variable === undefined || seenVariables.has(variable)) return undefined;

		const annotatedIdentifier = variable.identifiers.find(
			(identifier) => identifier.typeAnnotation !== null && identifier.typeAnnotation !== undefined,
		);
		if (annotatedIdentifier !== undefined) return knownAnnotationEvidence(annotatedIdentifier, boundary);

		const initializer = getKnownInitializer(variable, boundary);
		if (initializer === undefined) return undefined;

		seenVariables.add(variable);
		currentExpression = initializer;
	}
}

function widenedBinding(
	sourceCode: SourceCode,
	variable: ScopeVariable,
): (Except<WidenedBinding, "boundary"> & { boundary: ESTree.Node | undefined }) | undefined {
	const declarator = variableDeclarator(variable);
	if (declarator === undefined) return undefined;
	const bindingId: Parameter = declarator.id;
	if (
		!isVariableDeclaration(declarator.parent) ||
		declarator.parent.kind !== "const" ||
		!isBindingIdentifier(bindingId) ||
		declarator.init === null ||
		hasUninitializedWrite(variable)
	) {
		return undefined;
	}

	const boundary = getFunctionBoundary(declarator);
	const declaredAnnotation = annotationOfType(bindingId);
	const declaredType = declaredAnnotation?.typeAnnotation;
	const initializerAssertion = assertionFromExpression(declarator.init);
	const initializerBroadKind =
		initializerAssertion === undefined ? undefined : getBroadTypeKind(initializerAssertion.typeAnnotation);
	const declaredBroadKind = declaredType === undefined ? undefined : getBroadTypeKind(declaredType);
	const broadKind = declaredBroadKind ?? initializerBroadKind;
	if (broadKind === undefined) return undefined;

	const originalExpression =
		initializerAssertion !== undefined && initializerBroadKind !== undefined
			? assertedExpression(initializerAssertion)
			: declarator.init;
	const evidence = knownValueEvidence(sourceCode, originalExpression, boundary, new Set([variable]));
	if (evidence === undefined) return undefined;

	return { boundary, broadKind, declaredAt: declarator.range[1], evidence };
}

function assertionIsNarrower(
	sourceText: string,
	broadKind: BroadTypeKind,
	evidence: KnownValueEvidence,
	assertedType: ESTree.TSType,
): boolean {
	if (getBroadTypeKind(assertedType) !== undefined) return false;
	if (broadKind === "top" || typesHaveSameSyntax(sourceText, evidence.type, assertedType)) return true;
	if (broadKind === "object") return isDefinitelyObjectType(assertedType);
	return isDefinitelyNarrowerRecordType(assertedType);
}

const noWidenThenAssert = createRule("no-widen-then-assert", "anti-slop", {
	createOnce(context): Visitor {
		function checkAssertion(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void {
			const { sourceCode } = context;
			const expression = assertedExpression(node);
			if (!isBindingIdentifier(expression)) return;

			const variable = resolveVariable(sourceCode, expression);
			if (variable === undefined) return;

			const widened = widenedBinding(sourceCode, variable);
			if (
				widened === undefined ||
				node.range[0] <= widened.declaredAt ||
				getFunctionBoundary(node) !== widened.boundary ||
				!assertionIsNarrower(sourceCode.text, widened.broadKind, widened.evidence, node.typeAnnotation)
			) {
				return;
			}

			context.report({
				data: { name: expression.name },
				messageId: "widenThenAssert",
				node,
			});
		}

		return {
			TSAsExpression: checkAssertion,
			TSTypeAssertion: checkAssertion,
		};
	},
	meta: {
		docs: {
			description:
				"Disallow local const flows that explicitly widen a known value before asserting the widened binding to a narrower type.",
			recommended: true,
		},
		messages: {
			widenThenAssert:
				'Binding "{{name}}" discards type evidence and later recreates it with an assertion. Keep the precise type from initialization through use; parse boundary input once.',
		},
		type: "problem",
	},
});

export default noWidenThenAssert;
