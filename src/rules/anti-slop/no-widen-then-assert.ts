// Vendored from src/rules/no-widen-then-assert.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases; variable resolution uses the shared getVariableByName helper instead of
// upstream's scope-manager reference scan.

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

type BroadTypeKind = "object" | "record" | "top";

type Parameter = ESTree.ParamPattern;

type KnownValueEvidence = {
	readonly type: ESTree.TSType | null;
};

const FUNCTION_BOUNDARY_TYPES = new Set([
	"ArrowFunctionExpression",
	"FunctionDeclaration",
	"FunctionExpression",
	"TSDeclareFunction",
	"TSEmptyBodyFunctionExpression",
]);

interface WidenedBinding {
	readonly boundary: ESTree.Node | null;
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

function typeReferenceName(type: ESTree.TSTypeReference): string | null {
	return type.typeName.type === "Identifier" ? type.typeName.name : null;
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
		member.typeAnnotation !== null &&
		isUnknownOrAnyType(member.typeAnnotation.typeAnnotation)
	);
}

function broadTypeKind(type: ESTree.TSType): BroadTypeKind | null {
	const unwrapped = unwrapTypeParentheses(type);
	if (unwrapped.type === "TSAnyKeyword" || unwrapped.type === "TSUnknownKeyword") return "top";
	if (unwrapped.type === "TSObjectKeyword") return "object";
	return isBroadRecordType(unwrapped) ? "record" : null;
}

function assertedExpression(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): ESTree.Expression {
	return unwrapExpressionParentheses(node.expression);
}

function assertionFromExpression(expression: ESTree.Expression): ESTree.TSAsExpression | ESTree.TSTypeAssertion | null {
	const unwrapped = unwrapExpressionParentheses(expression);
	return unwrapped.type === "TSAsExpression" || unwrapped.type === "TSTypeAssertion" ? unwrapped : null;
}

function normalizedTypeText(sourceText: string, type: ESTree.TSType): string {
	return sourceText.slice(type.range[0], type.range[1]).replaceAll(/\s+/gu, "");
}

function typesHaveSameSyntax(sourceText: string, left: ESTree.TSType | null, right: ESTree.TSType): boolean {
	return (
		left !== null &&
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
		case "TSTypeLiteral":
			return unwrapped.members.length > 0;
		case "TSIntersectionType":
			return unwrapped.types.every(isDefinitelyObjectType);
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

function functionBoundary(node: ESTree.Node): ESTree.Node | null {
	let current: ESTree.Node | null = node.parent;
	while (current !== null && current.type !== "Program") {
		if (FUNCTION_BOUNDARY_TYPES.has(current.type)) return current;
		current = current.parent;
	}
	return null;
}

function resolveVariable(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): ScopeVariable | null {
	return getVariableByName(sourceCode.getScope(identifier), identifier.name) ?? null;
}

function variableDeclarator(variable: ScopeVariable): ESTree.VariableDeclarator | null {
	for (const definition of variable.defs) {
		if (definition.type === "Variable" && definition.node.type === "VariableDeclarator") {
			return definition.node;
		}
	}
	return null;
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

function knownValueEvidence(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	boundary: ESTree.Node | null,
	visitedVariables: ReadonlySet<ScopeVariable>,
): KnownValueEvidence | null {
	const unwrapped = unwrapExpressionParentheses(expression);

	if (unwrapped.type === "TSAsExpression" || unwrapped.type === "TSTypeAssertion") {
		/* v8 ignore next -- The broad-assertion path is retained for malformed/intermediate ASTs. @preserve */
		if (broadTypeKind(unwrapped.typeAnnotation) !== null) return null;
		return { type: unwrapped.typeAnnotation };
	}

	if (unwrapped.type === "Literal" || unwrapped.type === "TemplateLiteral") {
		return { type: null };
	}

	if (
		unwrapped.type === "ArrayExpression" ||
		unwrapped.type === "ArrowFunctionExpression" ||
		unwrapped.type === "ClassExpression" ||
		unwrapped.type === "FunctionExpression" ||
		unwrapped.type === "NewExpression" ||
		unwrapped.type === "ObjectExpression"
	) {
		return { type: null };
	}

	if (unwrapped.type !== "Identifier") return null;
	const variable = resolveVariable(sourceCode, unwrapped);
	if (variable === null || visitedVariables.has(variable)) return null;

	const annotatedIdentifier = variable.identifiers.find(
		(identifier) => identifier.typeAnnotation !== null && identifier.typeAnnotation !== undefined,
	);
	const annotation = annotatedIdentifier?.typeAnnotation?.typeAnnotation;
	if (annotation !== undefined && annotatedIdentifier !== undefined) {
		if (functionBoundary(annotatedIdentifier) !== boundary || broadTypeKind(annotation) !== null) {
			return null;
		}
		return { type: annotation };
	}

	const declarator = variableDeclarator(variable);
	if (
		declarator === null ||
		declarator.parent.type !== "VariableDeclaration" ||
		declarator.parent.kind !== "const" ||
		declarator.init === null ||
		hasUninitializedWrite(variable) ||
		functionBoundary(declarator) !== boundary
	) {
		return null;
	}

	return knownValueEvidence(sourceCode, declarator.init, boundary, new Set([...visitedVariables, variable]));
}

function widenedBinding(
	sourceCode: SourceCode,
	variable: ScopeVariable,
): (Omit<WidenedBinding, "boundary"> & { boundary: ESTree.Node | null }) | null {
	const declarator = variableDeclarator(variable);
	if (declarator === null) return null;
	const bindingId: Parameter = declarator.id;
	if (
		declarator.parent.type !== "VariableDeclaration" ||
		declarator.parent.kind !== "const" ||
		bindingId.type !== "Identifier" ||
		declarator.init === null ||
		hasUninitializedWrite(variable)
	) {
		return null;
	}

	const boundary = functionBoundary(declarator);
	const declaredAnnotation = annotationOfType(bindingId);
	const declaredType = declaredAnnotation === undefined ? null : declaredAnnotation.typeAnnotation;
	const initializerAssertion = assertionFromExpression(declarator.init);
	const initializerBroadKind =
		initializerAssertion === null ? null : broadTypeKind(initializerAssertion.typeAnnotation);
	const declaredBroadKind = declaredType === null ? null : broadTypeKind(declaredType);
	const broadKind = declaredBroadKind ?? initializerBroadKind;
	if (broadKind === null) return null;

	const originalExpression =
		initializerAssertion !== null && initializerBroadKind !== null
			? assertedExpression(initializerAssertion)
			: declarator.init;
	const evidence = knownValueEvidence(sourceCode, originalExpression, boundary, new Set([variable]));
	if (evidence === null) return null;
	return { boundary, broadKind, declaredAt: declarator.range[1], evidence };
}

function assertionIsNarrower(
	sourceText: string,
	broadKind: BroadTypeKind,
	evidence: KnownValueEvidence,
	assertedType: ESTree.TSType,
): boolean {
	if (broadTypeKind(assertedType) !== null) return false;
	if (broadKind === "top") return true;
	if (typesHaveSameSyntax(sourceText, evidence.type, assertedType)) return true;
	if (broadKind === "object") return isDefinitelyObjectType(assertedType);
	return isDefinitelyNarrowerRecordType(assertedType);
}

const noWidenThenAssert = createRule("no-widen-then-assert", "anti-slop", {
	createOnce(context): Visitor {
		function checkAssertion(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void {
			const sourceCode = context.sourceCode;
			const expression = assertedExpression(node);
			if (expression.type !== "Identifier") return;

			const variable = resolveVariable(sourceCode, expression);
			if (variable === null) return;
			const widened = widenedBinding(sourceCode, variable);
			if (
				widened === null ||
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
