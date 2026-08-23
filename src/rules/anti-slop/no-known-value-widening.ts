// Vendored from src/rules/no-known-value-widening.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases; variable resolution uses the shared getVariableByName helper instead of
// upstream's inline scope walk. Parent-assertion suppression climbs parentheses
// because the local parser preserves ParenthesizedExpression nodes.

import {
	classifyWideningTarget,
	createTypeEnvironment,
	isKnownEvidenceExpression,
} from "$oxc-utilities/anti-slop/dictionary-types";
import { getVariableByName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { TypeEnvironment, WideningTarget } from "$oxc-utilities/anti-slop/dictionary-types";
import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

type FunctionExpression = ESTree.ArrowFunctionExpression | ESTree.Function;

function resolveVariable(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): ScopeVariable | undefined {
	return getVariableByName(sourceCode.getScope(identifier), identifier.name);
}

function variableDeclarator(variable: ScopeVariable): ESTree.VariableDeclarator | undefined {
	/* v8 ignore next -- Scope lookups omit unresolved globals instead of returning zero-definition variables. @preserve */
	if (variable.defs.length !== 1) return undefined;
	const [definition] = variable.defs;
	if (definition?.type !== "Variable") return undefined;
	const { node } = definition;
	/* v8 ignore next -- Variable definitions are always declarator nodes in this parser. @preserve */
	return node.type === "VariableDeclarator" ? node : undefined;
}

function isStableConstVariable(variable: ScopeVariable, declarator: ESTree.VariableDeclarator): boolean {
	return (
		declarator.parent.type === "VariableDeclaration" &&
		declarator.parent.kind === "const" &&
		variable.references.every((reference) => reference.init || !reference.isWrite())
	);
}

function hasKnownEvidence(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	visitedVariables: Set<ScopeVariable> = new Set(),
): boolean {
	if (isKnownEvidenceExpression(expression)) return true;
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type !== "Identifier") return false;
	const variable = resolveVariable(sourceCode, unwrapped);
	if (variable === undefined || visitedVariables.has(variable)) return false;
	const declarator = variableDeclarator(variable);
	if (declarator === undefined || declarator.init === null || !isStableConstVariable(variable, declarator)) {
		return false;
	}
	visitedVariables.add(variable);
	return hasKnownEvidence(sourceCode, declarator.init, visitedVariables);
}

function annotationTarget(annotation: ESTree.TSTypeAnnotation | null | undefined, environment: TypeEnvironment) {
	return annotation === null || annotation === undefined
		? undefined
		: classifyWideningTarget(annotation.typeAnnotation, environment);
}

function enclosingFunction(node: ESTree.Node): FunctionExpression | undefined {
	let current: ESTree.Node | null = node.parent;
	while (current !== null && current.type !== "Program") {
		if (
			current.type === "ArrowFunctionExpression" ||
			current.type === "FunctionDeclaration" ||
			current.type === "FunctionExpression"
		) {
			return current;
		}
		current = current.parent;
	}
	/* v8 ignore next -- top-level returns only occur in script sources this suite does not exercise. @preserve */
	return undefined;
}

function sourceKeyName(sourceCode: SourceCode, key: ESTree.PropertyKey): string {
	if (key.type === "Identifier" || key.type === "PrivateIdentifier") return key.name;
	if (key.type === "Literal") return String(key.value);
	return sourceCode.getText(key);
}

function functionName(sourceCode: SourceCode, owner: FunctionExpression | undefined): string {
	/* v8 ignore next 3 -- top-level returns only occur in script sources this suite does not exercise. @preserve */
	if (owner === undefined) return "anonymous function";
	if (owner.id !== null) return owner.id.name;
	const parent = owner.parent;
	if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
	if (parent.type === "MethodDefinition") return sourceKeyName(sourceCode, parent.key);
	return "anonymous function";
}

function isEmptyObjectExpression(expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpressionParentheses(expression);
	return unwrapped.type === "ObjectExpression" && unwrapped.properties.length === 0;
}

function isDictionaryAccumulatorTarget(destination: WideningTarget): boolean {
	return destination.kind === "open dictionary" || destination.kind === "generic container";
}

function hasParentAssertion(node: ESTree.Node): boolean {
	let current: ESTree.Node | null | undefined = node.parent;
	while (current?.type === "ParenthesizedExpression") current = current.parent;
	return current?.type === "TSAsExpression" || current?.type === "TSTypeAssertion";
}

function unwrapExpressionParentheses(expression: ESTree.Expression): ESTree.Expression {
	let current = expression;
	while (
		current.type === "ParenthesizedExpression" ||
		current.type === "TSAsExpression" ||
		current.type === "TSSatisfiesExpression" ||
		current.type === "TSTypeAssertion" ||
		current.type === "TSNonNullExpression"
	) {
		current = current.expression;
	}
	return current;
}

const noKnownValueWidening = createRule("no-known-value-widening", "anti-slop", {
	createOnce(context): Visitor {
		let environment: TypeEnvironment | undefined;

		function reportFlow(
			expression: ESTree.Expression,
			destination: WideningTarget | undefined,
			subject: string,
		): void {
			if (destination === undefined) return;
			if (isDictionaryAccumulatorTarget(destination) && isEmptyObjectExpression(expression)) return;
			if (!hasKnownEvidence(context.sourceCode, expression)) return;
			context.report({
				data: { subject, target: destination.kind },
				messageId: "widening",
				node: expression,
			});
		}

		function targetFromAnnotation(annotation: ESTree.TSTypeAnnotation | null | undefined) {
			/* v8 ignore next -- the environment is always built by the Program visitor first. @preserve */
			return environment === undefined ? undefined : annotationTarget(annotation, environment);
		}

		return {
			ArrowFunctionExpression(node): void {
				if (node.body.type === "BlockStatement") return;
				reportFlow(
					node.body,
					targetFromAnnotation(node.returnType),
					`return value of \`${functionName(context.sourceCode, node)}\``,
				);
			},
			AssignmentExpression(node): void {
				if (node.operator !== "=" || node.left.type !== "Identifier") return;
				const variable = resolveVariable(context.sourceCode, node.left);
				if (variable === undefined) return;
				const declarator = variableDeclarator(variable);
				if (declarator === undefined || declarator.id.type !== "Identifier") return;
				reportFlow(
					node.right,
					targetFromAnnotation(declarator.id.typeAnnotation),
					`binding \`${declarator.id.name}\``,
				);
			},
			Program(node): void {
				environment = createTypeEnvironment(node);
			},
			PropertyDefinition(node): void {
				if (node.value === null) return;
				reportFlow(
					node.value,
					targetFromAnnotation(node.typeAnnotation),
					`property \`${sourceKeyName(context.sourceCode, node.key)}\``,
				);
			},
			ReturnStatement(node): void {
				if (node.argument === null) return;
				const owner = enclosingFunction(node);
				reportFlow(
					node.argument,
					targetFromAnnotation(owner?.returnType),
					`return value of \`${functionName(context.sourceCode, owner)}\``,
				);
			},
			TSAsExpression(node): void {
				if (environment === undefined || hasParentAssertion(node)) return;
				reportFlow(node.expression, classifyWideningTarget(node.typeAnnotation, environment), "assertion");
			},
			TSTypeAssertion(node): void {
				/* v8 ignore next -- The Program visitor initializes this before descendants run. @preserve */
				if (environment === undefined) return;
				if (hasParentAssertion(node)) return;
				reportFlow(node.expression, classifyWideningTarget(node.typeAnnotation, environment), "assertion");
			},
			VariableDeclarator(node): void {
				if (node.init === null || node.id.type !== "Identifier") return;
				reportFlow(node.init, targetFromAnnotation(node.id.typeAnnotation), `binding \`${node.id.name}\``);
			},
		};
	},
	meta: {
		docs: {
			description:
				"Disallow syntactically established values from flowing into explicitly broad or anonymous target types that discard useful evidence.",
			recommended: true,
		},
		messages: {
			widening:
				"The explicit {{target}} type on {{subject}} discards known type evidence. Keep inference, validate with `satisfies`, or use a named owner contract.",
		},
		type: "problem",
	},
});

export default noKnownValueWidening;
