// Vendored from src/rules/no-known-value-widening.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local
// path aliases; assertion nesting checks climb parenthesized expressions that
// yuku-parser preserves rather than drops; enclosing functions are tracked
// with an enter/exit visitor stack instead of an ancestor walk.

import {
	classifyWideningTarget,
	createTypeEnvironment,
	isKnownEvidenceExpression,
} from "$oxc-utilities/anti-slop/dictionary-types";
import { getVariableByName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Variable, Visitor } from "oxlint-plugin-utilities";

import type { TypeEnvironment } from "$oxc-utilities/anti-slop/dictionary-types";

type FunctionExpression = ESTree.ArrowFunctionExpression | ESTree.Function;

function variableDeclarator(variable: Variable): ESTree.VariableDeclarator | undefined {
	const [definition] = variable.defs;
	return definition?.type === "Variable" && definition.node.type === "VariableDeclarator"
		? definition.node
		: undefined;
}

function isUnwrittenConstantBinding(variable: Variable, declarator: ESTree.VariableDeclarator): boolean {
	return (
		declarator.parent.type === "VariableDeclaration" &&
		declarator.parent.kind === "const" &&
		variable.references.every((reference) => reference.init || !reference.isWrite())
	);
}

function hasKnownEvidence(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	knownEvidenceVariables: WeakSet<Variable>,
): boolean {
	if (isKnownEvidenceExpression(expression)) return true;
	const unwrapped = unwrapExpression(expression);
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
		!isUnwrittenConstantBinding(variable, node) ||
		!hasKnownEvidence(sourceCode, node.init, knownEvidenceVariables)
	) {
		return;
	}
	knownEvidenceVariables.add(variable);
}

function functionName(owner: FunctionExpression | undefined): string {
	if (!owner?.id) return "anonymous function";
	return owner.id.name;
}

function isEmptyObjectExpression(expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	return unwrapped.type === "ObjectExpression" && unwrapped.properties.length === 0;
}

function isNestedInAssertion(node: { readonly parent: ESTree.Node }): boolean {
	let current = node.parent;
	while (current.type === "ParenthesizedExpression") current = current.parent;
	return current.type === "TSAsExpression" || current.type === "TSTypeAssertion";
}

type NullableAnnotation = ESTree.TSTypeAnnotation | Exclude<ESTree.Node["parent"], ESTree.Node>;

interface TypeAnnotatedBinding {
	readonly typeAnnotation?: NullableAnnotation;
}

function typeAnnotationFromBinding(node: { readonly id: TypeAnnotatedBinding }): ESTree.TSType | undefined {
	return node.id.typeAnnotation?.typeAnnotation;
}

const noKnownValueWidening = createRule("no-known-value-widening", "anti-slop", {
	createOnce(context): Visitor {
		let environment: TypeEnvironment | undefined;
		const knownEvidenceVariables = new WeakSet<Variable>();
		const enclosingFunctions = new Array<FunctionExpression>();

		function reportFlow(expression: ESTree.Expression, target: ESTree.TSType | undefined, subject: string): void {
			if (environment === undefined || target === undefined) return;
			const wideningTarget = classifyWideningTarget(target, environment);
			if (
				wideningTarget === undefined ||
				!hasKnownEvidence(context.sourceCode, expression, knownEvidenceVariables)
			) {
				return;
			}
			if (
				(wideningTarget === "open dictionary" || wideningTarget === "generic container") &&
				isEmptyObjectExpression(expression)
			) {
				return;
			}
			context.report({
				data: { subject, target: wideningTarget },
				messageId: "widening",
				node: expression,
			});
		}

		return {
			ArrowFunctionExpression(node): void {
				enclosingFunctions.push(node);
				if (node.body.type !== "BlockStatement") {
					reportFlow(node.body, node.returnType?.typeAnnotation, `return value of \`${functionName(node)}\``);
				}
			},
			"ArrowFunctionExpression:exit"(): void {
				enclosingFunctions.pop();
			},
			AssignmentExpression(node): void {
				if (node.operator !== "=" || node.left.type !== "Identifier") return;
				const variable = getVariableByName(context.sourceCode.getScope(node.left), node.left.name);
				if (variable === undefined) return;
				const declarator = variableDeclarator(variable);
				if (declarator === undefined) return;
				reportFlow(node.right, typeAnnotationFromBinding(declarator), `binding \`${node.left.name}\``);
			},
			FunctionDeclaration(node): void {
				enclosingFunctions.push(node);
			},
			"FunctionDeclaration:exit"(): void {
				enclosingFunctions.pop();
			},
			FunctionExpression(node): void {
				enclosingFunctions.push(node);
			},
			"FunctionExpression:exit"(): void {
				enclosingFunctions.pop();
			},
			Program(node): void {
				environment = createTypeEnvironment(node);
			},
			ReturnStatement(node): void {
				if (!node.argument) return;
				const owner = enclosingFunctions.at(-1);
				reportFlow(
					node.argument,
					owner?.returnType?.typeAnnotation,
					`return value of \`${functionName(owner)}\``,
				);
			},
			TSAsExpression(node): void {
				/* v8 ignore next -- the istanbul conversion emits an empty implicit-else arm for this branch. @preserve */
				if (!isNestedInAssertion(node)) {
					reportFlow(node.expression, node.typeAnnotation, "assertion");
				}
			},
			TSTypeAssertion(node): void {
				/* v8 ignore next -- the istanbul conversion emits an empty implicit-else arm for this branch. @preserve */
				if (!isNestedInAssertion(node)) {
					reportFlow(node.expression, node.typeAnnotation, "assertion");
				}
			},
			VariableDeclarator(node): void {
				if (!node.init) return;
				recordKnownEvidence(context.sourceCode, node, knownEvidenceVariables);
				reportFlow(
					node.init,
					typeAnnotationFromBinding(node),
					`binding \`${context.sourceCode.getText(node.id)}\``,
				);
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
