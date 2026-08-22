// Vendored from src/rules/no-widen-then-assert.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path aliases.

import { getVariableByName, unwrapParenthesis } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Variable, Visitor } from "oxlint-plugin-utilities";

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;
type BroadTypeKind = "object" | "record" | "top";

function broadTypeKind(type: ESTree.TSType): BroadTypeKind | undefined {
	const unwrapped = type.type === "TSParenthesizedType" ? type.typeAnnotation : type;
	if (unwrapped.type === "TSUnknownKeyword" || unwrapped.type === "TSAnyKeyword") return "top";
	if (unwrapped.type === "TSObjectKeyword") return "object";
	if (unwrapped.type !== "TSTypeReference" || unwrapped.typeName.type !== "Identifier") return undefined;
	if (unwrapped.typeName.name !== "Record") return undefined;
	const value = unwrapped.typeArguments?.params[1];
	return value?.type === "TSUnknownKeyword" || value?.type === "TSAnyKeyword" ? "record" : undefined;
}

function variableDeclarator(variable: Variable): ESTree.VariableDeclarator | undefined {
	const definition = variable.defs.find((candidate) => candidate.type === "Variable");
	return definition?.node.type === "VariableDeclarator" ? definition.node : undefined;
}

function hasKnownEvidence(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	knownEvidenceVariables: WeakSet<Variable>,
): boolean {
	const unwrapped = unwrapParenthesis(expression);
	if (
		unwrapped.type === "ObjectExpression" ||
		unwrapped.type === "ArrayExpression" ||
		unwrapped.type === "Literal" ||
		unwrapped.type === "TemplateLiteral" ||
		unwrapped.type === "TSAsExpression" ||
		unwrapped.type === "TSTypeAssertion"
	) {
		return true;
	}
	if (unwrapped.type !== "Identifier") return false;
	const variable = getVariableByName(sourceCode.getScope(unwrapped), unwrapped.name);
	return variable !== undefined && knownEvidenceVariables.has(variable);
}

function recordKnownEvidence(
	sourceCode: SourceCode,
	node: ESTree.VariableDeclarator,
	knownEvidenceVariables: WeakSet<Variable>,
): void {
	if (node.id.type !== "Identifier" || !node.init) return;
	const variable = getVariableByName(sourceCode.getScope(node.id), node.id.name);
	if (
		variable === undefined ||
		variableDeclarator(variable) !== node ||
		!hasKnownEvidence(sourceCode, node.init, knownEvidenceVariables)
	) {
		return;
	}
	knownEvidenceVariables.add(variable);
}

function isNarrowerThan(type: ESTree.TSType, broadKind: BroadTypeKind): boolean {
	const target = broadTypeKind(type);
	if (target !== undefined) return false;
	const unwrapped = type.type === "TSParenthesizedType" ? type.typeAnnotation : type;
	return (
		broadKind === "top" ||
		(broadKind === "object" && unwrapped.type === "TSTypeLiteral") ||
		(broadKind === "record" && unwrapped.type === "TSTypeLiteral")
	);
}

type NullableAnnotation = ESTree.TSTypeAnnotation | Exclude<ESTree.Node["parent"], ESTree.Node>;

interface TypeAnnotatedBinding {
	readonly typeAnnotation?: NullableAnnotation;
}

function typeAnnotationFromBinding(node: { readonly id: TypeAnnotatedBinding }): ESTree.TSType | undefined {
	return node.id.typeAnnotation?.typeAnnotation;
}

const noWidenThenAssert = createRule("no-widen-then-assert", "anti-slop", {
	createOnce(context): Visitor {
		const knownEvidenceVariables = new WeakSet<Variable>();

		function checkAssertion(node: TypeAssertion): void {
			const expression = unwrapParenthesis(node.expression);
			if (expression.type !== "Identifier") return;
			const variable = getVariableByName(context.sourceCode.getScope(expression), expression.name);
			if (variable === undefined) return;
			const declarator = variableDeclarator(variable);
			if (!declarator?.init) return;
			if (
				declarator.parent.type !== "VariableDeclaration" ||
				declarator.parent.kind !== "const" ||
				declarator.end >= node.start ||
				!hasKnownEvidence(context.sourceCode, declarator.init, knownEvidenceVariables)
			) {
				return;
			}
			const annotation = typeAnnotationFromBinding(declarator);
			const broadKind = annotation === undefined ? undefined : broadTypeKind(annotation);
			if (broadKind === undefined || !isNarrowerThan(node.typeAnnotation, broadKind)) return;
			context.report({ data: { name: expression.name }, messageId: "widenThenAssert", node });
		}

		return {
			TSAsExpression: checkAssertion,
			TSTypeAssertion: checkAssertion,
			VariableDeclarator(node): void {
				if (!node.init) return;
				recordKnownEvidence(context.sourceCode, node, knownEvidenceVariables);
			},
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
				"Binding `{{name}}` discards type evidence and later recreates it with an assertion. Keep the precise type from initialization through use; parse boundary input once.",
		},
		type: "problem",
	},
});

export default noWidenThenAssert;
