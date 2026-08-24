// Vendored from src/rules/no-widen-then-assert.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases; variable resolution uses the shared getVariableByName helper
// instead of upstream's scope-manager reference scan.

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";
import type { Except } from "type-fest";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

type BroadTypeKind = "object" | "record" | "top";

type Parameter = ESTree.ParamPattern;

interface KnownValueEvidence {
	readonly type: ESTree.TSType | undefined;
}

const FUNCTION_BOUNDARY_TYPES = new Set([
	"ArrowFunctionExpression",
	"FunctionDeclaration",
	"FunctionExpression",
	"TSDeclareFunction",
	"TSEmptyBodyFunctionExpression",
]);

interface WidenedBinding {
	readonly boundary: ESTree.Node | undefined;
	readonly broadKind: BroadTypeKind;
	readonly declaredAt: number;
	readonly evidence: KnownValueEvidence;
}

function unwrapExpressionParentheses(expression: ESTree.Expression): ESTree.Expression {
	let current = expression;
	while (current.type === "ParenthesizedExpression") current = current.expression;
	return current;
}

function unwrapTypeParentheses(type: ESTree.TSType): ESTree.TSType {
	let current = type;
	while (current.type === "TSParenthesizedType") current = current.typeAnnotation;
	return current;
}

function typeReferenceName(type: ESTree.TSTypeReference): string | undefined {
	return type.typeName.type === "Identifier" ? type.typeName.name : undefined;
}

function isUnknownOrAnyType(type: ESTree.TSType): boolean {
	const unwrapped = unwrapTypeParentheses(type);
	return unwrapped.type === "TSAnyKeyword" || unwrapped.type === "TSUnknownKeyword";
}

function isBroadRecordKeyType(type: ESTree.TSType): boolean {
	const unwrapped = unwrapTypeParentheses(type);
	if (
		unwrapped.type === "TSNumberKeyword" ||
		unwrapped.type === "TSStringKeyword" ||
		unwrapped.type === "TSSymbolKeyword"
	) {
		return true;
	}
	if (unwrapped.type === "TSUnionType") return unwrapped.types.every(isBroadRecordKeyType);
	return unwrapped.type === "TSTypeReference" && typeReferenceName(unwrapped) === "PropertyKey";
}

function isBroadRecordType(type: ESTree.TSType): boolean {
	const unwrapped = unwrapTypeParentheses(type);

	if (unwrapped.type === "TSTypeReference") {
		if (typeReferenceName(unwrapped) === "Readonly") {
			/* v8 ignore next 2 -- A bare Readonly type is parser-valid but has no meaningful assertion contract. @preserve */
			const [inner] = unwrapped.typeArguments?.params ?? [];
			return inner !== undefined && isBroadRecordType(inner);
		}

		if (typeReferenceName(unwrapped) !== "Record") return false;
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

	if (unwrapped.type !== "TSTypeLiteral" || unwrapped.members.length !== 1) return false;
	const [member] = unwrapped.members;
	if (member?.type !== "TSIndexSignature" || member.parameters.length !== 1) return false;
	const [parameter] = member.parameters;
	return (
		parameter !== undefined &&
		isBroadRecordKeyType(parameter.typeAnnotation.typeAnnotation) &&
		isUnknownOrAnyType(member.typeAnnotation.typeAnnotation)
	);
}

function broadTypeKind(type: ESTree.TSType): BroadTypeKind | undefined {
	const unwrapped = unwrapTypeParentheses(type);
	if (unwrapped.type === "TSAnyKeyword" || unwrapped.type === "TSUnknownKeyword") return "top";
	if (unwrapped.type === "TSObjectKeyword") return "object";
	return isBroadRecordType(unwrapped) ? "record" : undefined;
}

function assertedExpression(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): ESTree.Expression {
	return unwrapExpressionParentheses(node.expression);
}

function assertionFromExpression(
	expression: ESTree.Expression,
): ESTree.TSAsExpression | ESTree.TSTypeAssertion | undefined {
	const unwrapped = unwrapExpressionParentheses(expression);
	return unwrapped.type === "TSAsExpression" || unwrapped.type === "TSTypeAssertion" ? unwrapped : undefined;
}

function normalizedTypeText(sourceText: string, type: ESTree.TSType): string {
	return sourceText.slice(type.range[0], type.range[1]).replaceAll(/\s+/gu, "");
}

function typesHaveSameSyntax(sourceText: string, left: ESTree.TSType | undefined, right: ESTree.TSType): boolean {
	return (
		left !== undefined &&
		normalizedTypeText(sourceText, unwrapTypeParentheses(left)) ===
			normalizedTypeText(sourceText, unwrapTypeParentheses(right))
	);
}

function isDefinitelyObjectType(type: ESTree.TSType): boolean {
	const unwrapped = unwrapTypeParentheses(type);
	switch (unwrapped.type) {
		case "TSArrayType":
		case "TSConstructorType":
		case "TSFunctionType":
		case "TSMappedType":
		case "TSObjectKeyword":
		case "TSTupleType":
			return true;
		case "TSIntersectionType":
			return unwrapped.types.every(isDefinitelyObjectType);
		case "TSTypeLiteral":
			return unwrapped.members.length > 0;
		case "TSTypeOperator":
			return unwrapped.operator === "readonly" && isDefinitelyObjectType(unwrapped.typeAnnotation);
		default:
			return false;
	}
}

function isDefinitelyNarrowerRecordType(type: ESTree.TSType): boolean {
	const unwrapped = unwrapTypeParentheses(type);
	if (unwrapped.type === "TSTypeLiteral") {
		return unwrapped.members.some((member) => member.type !== "TSIndexSignature");
	}

	if (unwrapped.type !== "TSTypeReference") return false;
	if (typeReferenceName(unwrapped) === "Readonly") {
		const [inner] = unwrapped.typeArguments?.params ?? [];
		return inner !== undefined && isDefinitelyNarrowerRecordType(inner);
	}
	if (typeReferenceName(unwrapped) !== "Record") return false;
	const parameters = unwrapped.typeArguments?.params ?? [];
	return parameters.length === 2 && parameters[1] !== undefined && !isUnknownOrAnyType(parameters[1]);
}

function functionBoundary(node: ESTree.Node): ESTree.Node | undefined {
	/* v8 ignore next -- Rule visitors never request a boundary for the Program root. @preserve */
	let current = node.parent ?? undefined;
	while (current !== undefined && current.type !== "Program") {
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
		if (definition.type === "Variable" && definition.node.type === "VariableDeclarator") {
			return definition.node;
		}
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
	const unwrapped = unwrapExpressionParentheses(expression);
	if (unwrapped.type === "TSAsExpression" || unwrapped.type === "TSTypeAssertion") {
		/* v8 ignore next -- The broad-assertion path is retained for malformed/intermediate ASTs. @preserve */
		if (broadTypeKind(unwrapped.typeAnnotation) !== undefined) return undefined;
		return { type: unwrapped.typeAnnotation };
	}
	if (unwrapped.type === "Literal" || unwrapped.type === "TemplateLiteral") return { type: undefined };
	if (
		unwrapped.type === "ArrayExpression" ||
		unwrapped.type === "ArrowFunctionExpression" ||
		unwrapped.type === "ClassExpression" ||
		unwrapped.type === "FunctionExpression" ||
		unwrapped.type === "NewExpression" ||
		unwrapped.type === "ObjectExpression"
	) {
		return { type: undefined };
	}
	return undefined;
}

function knownAnnotationEvidence(
	identifier: ScopeVariable["identifiers"][number],
	boundary: ESTree.Node | undefined,
): KnownValueEvidence | undefined {
	const annotation = identifier.typeAnnotation?.typeAnnotation;
	/* v8 ignore next -- Callers select only identifiers with an annotation. @preserve */
	if (annotation === undefined) return undefined;
	if (functionBoundary(identifier) !== boundary || broadTypeKind(annotation) !== undefined) return undefined;
	return { type: annotation };
}

function knownInitializer(variable: ScopeVariable, boundary: ESTree.Node | undefined): ESTree.Expression | undefined {
	const declarator = variableDeclarator(variable);
	if (declarator === undefined) return undefined;
	if (
		declarator.parent.type !== "VariableDeclaration" ||
		declarator.parent.kind !== "const" ||
		declarator.init === null ||
		hasUninitializedWrite(variable) ||
		functionBoundary(declarator) !== boundary
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
		const unwrapped = unwrapExpressionParentheses(currentExpression);
		if (unwrapped.type !== "Identifier") return undefined;
		const variable = resolveVariable(sourceCode, unwrapped);
		if (variable === undefined || seenVariables.has(variable)) return undefined;
		const annotatedIdentifier = variable.identifiers.find(
			(identifier) => identifier.typeAnnotation !== null && identifier.typeAnnotation !== undefined,
		);
		if (annotatedIdentifier !== undefined) return knownAnnotationEvidence(annotatedIdentifier, boundary);
		const initializer = knownInitializer(variable, boundary);
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
		declarator.parent.type !== "VariableDeclaration" ||
		declarator.parent.kind !== "const" ||
		bindingId.type !== "Identifier" ||
		declarator.init === null ||
		hasUninitializedWrite(variable)
	) {
		return undefined;
	}

	const boundary = functionBoundary(declarator);
	const declaredAnnotation = annotationOfType(bindingId);
	const declaredType = declaredAnnotation?.typeAnnotation;
	const initializerAssertion = assertionFromExpression(declarator.init);
	const initializerBroadKind =
		initializerAssertion === undefined ? undefined : broadTypeKind(initializerAssertion.typeAnnotation);
	const declaredBroadKind = declaredType === undefined ? undefined : broadTypeKind(declaredType);
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
	if (broadTypeKind(assertedType) !== undefined) return false;
	if (broadKind === "top") return true;
	if (typesHaveSameSyntax(sourceText, evidence.type, assertedType)) return true;
	if (broadKind === "object") return isDefinitelyObjectType(assertedType);
	return isDefinitelyNarrowerRecordType(assertedType);
}

const noWidenThenAssert = createRule("no-widen-then-assert", "anti-slop", {
	createOnce(context): Visitor {
		function checkAssertion(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void {
			const { sourceCode } = context;
			const expression = assertedExpression(node);
			if (expression.type !== "Identifier") return;

			const variable = resolveVariable(sourceCode, expression);
			if (variable === undefined) return;
			const widened = widenedBinding(sourceCode, variable);
			if (
				widened === undefined ||
				node.range[0] <= widened.declaredAt ||
				functionBoundary(node) !== widened.boundary ||
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
