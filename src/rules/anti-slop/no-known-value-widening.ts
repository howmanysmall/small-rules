// Vendored from src/rules/no-known-value-widening.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API, local path
// aliases, shared guards, and undefined absence values. Variable resolution
// uses getVariableByName, and evidence follows const chains iteratively.
// Explicit binding, annotation, and assertion barriers are respected. Parent
// suppression climbs parser-preserved transparent expression wrappers.

import {
	classifyUnsafeDictionaryValue,
	classifyWideningTarget,
	createTypeEnvironment,
	isKnownEvidenceExpression,
} from "$oxc-utilities/anti-slop/dictionary-types";
import {
	containsUnknownType,
	getFunctionParameterBindingName,
	getFunctionParameterTypeAnnotation,
} from "$oxc-utilities/anti-slop/function-parameters";
import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isAccessorProperty,
	isAnyFunction,
	isAnyLiteral,
	isBindingIdentifier,
	isBlockStatement,
	isCallExpression,
	isFunctionLike,
	isIdentifierName,
	isIdentifierReference,
	isMethodDefinition,
	isObjectExpression,
	isParenthesizedExpression,
	isPrivateIdentifier,
	isProgram,
	isSpreadElement,
	isTsAsExpression,
	isTsNonNullExpression,
	isTsSatisfiesExpression,
	isTsTypeAssertion,
	isTsTypePredicate,
	isVariableDeclaration,
	isVariableDeclarator,
	unwrapExpression,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { TypeEnvironment, WideningTarget } from "$oxc-utilities/anti-slop/dictionary-types";
import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

type FunctionExpression = ESTree.ArrowFunctionExpression | ESTree.Function;

interface PredicateSubject {
	argumentIndex: number;
	parameter: ESTree.ParamPattern;
}

function resolveVariable(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): ScopeVariable | undefined {
	return getVariableByName(sourceCode.getScope(identifier), identifier.name);
}

function getVariableDeclarator(variable: ScopeVariable): ESTree.VariableDeclarator | undefined {
	/* v8 ignore next -- Scope lookups omit unresolved globals instead of returning zero-definition variables. @preserve */
	if (variable.defs.length !== 1) return undefined;

	const [definition] = variable.defs;
	if (definition?.type !== "Variable") return undefined;

	const { node } = definition;
	/* v8 ignore next -- Variable definitions are always declarator nodes in this parser. @preserve */
	return isVariableDeclarator(node) ? node : undefined;
}

function isStableConstVariable(variable: ScopeVariable, declarator: ESTree.VariableDeclarator): boolean {
	return (
		isVariableDeclaration(declarator.parent) &&
		declarator.parent.kind === "const" &&
		variable.references.every((reference) => reference.init || !reference.isWrite())
	);
}

function isUnvisitedVariable(
	variable: ScopeVariable | undefined,
	visited: Set<ScopeVariable>,
): variable is ScopeVariable {
	return variable !== undefined && !visited.has(variable);
}

function hasStableInitializer(
	variable: ScopeVariable,
	declarator: ESTree.VariableDeclarator | undefined,
): declarator is ESTree.VariableDeclarator & { init: ESTree.Expression } {
	if (declarator === undefined) return false;
	return declarator.init !== null && isStableConstVariable(variable, declarator);
}

function hasInformativeReturnType(returnType: ESTree.TSType | undefined, environment: TypeEnvironment): boolean {
	return returnType !== undefined && hasInformativeType(returnType, environment);
}

function getAssertionEvidence(expression: ESTree.Expression, environment: TypeEnvironment): boolean | undefined {
	return isTsAsExpression(expression) || isTsTypeAssertion(expression)
		? hasInformativeType(expression.typeAnnotation, environment)
		: undefined;
}

function hasKnownEvidence(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	environment: TypeEnvironment,
): boolean {
	const visitedVariables = new Set<ScopeVariable>();
	let currentExpression = expression;
	for (;;) {
		if (isKnownEvidenceExpression(currentExpression)) return true;
		if (!isIdentifierReference(currentExpression)) return false;

		const variable = resolveVariable(sourceCode, currentExpression);
		if (!isUnvisitedVariable(variable, visitedVariables)) return false;

		const annotation = getVariableTypeAnnotation(sourceCode, variable);
		if (annotation !== undefined) return hasInformativeType(annotation.typeAnnotation, environment);

		const declarator = getVariableDeclarator(variable);
		if (!hasStableInitializer(variable, declarator)) return false;

		visitedVariables.add(variable);
		currentExpression = unwrapCallArgumentExpression(declarator.init);
		const evidence = getAssertionEvidence(currentExpression, environment);
		if (evidence !== undefined) return evidence;
	}
}

function getLocalFunctionForCall(sourceCode: SourceCode, callee: ESTree.Expression): FunctionExpression | undefined {
	const unwrapped = unwrapExpression(callee);
	if (isFunctionLike(unwrapped)) return unwrapped;
	if (!isIdentifierReference(unwrapped)) return undefined;

	const variable = resolveVariable(sourceCode, unwrapped);
	if (variable?.defs.length !== 1) return undefined;

	const [definition] = variable.defs;
	/* v8 ignore next -- A one-element definitions array has a first item. @preserve */
	if (definition === undefined) return undefined;

	if (definition.type === "FunctionName") {
		const { node } = definition;
		/* v8 ignore next -- FunctionName definitions own function-like nodes. @preserve */
		if (!isFunctionLike(node)) return undefined;
		return node;
	}

	if (definition.type !== "Variable" || !isVariableDeclarator(definition.node)) return undefined;
	if (isBindingIdentifier(definition.node.id) && definition.node.id.typeAnnotation !== null) {
		// The explicit binding contract hides initializer-only predicate details.
		return undefined;
	}

	const initializer = definition.node.init;
	if (initializer === null) return undefined;
	const unwrappedInitializer = unwrapExpression(initializer);
	return isFunctionLike(unwrappedInitializer) ? unwrappedInitializer : undefined;
}

function getVariableTypeAnnotation(
	sourceCode: SourceCode,
	variable: ScopeVariable,
): ESTree.TSTypeAnnotation | undefined {
	if (variable.defs.length !== 1) return undefined;
	const [definition] = variable.defs;
	/* v8 ignore next -- A one-element definitions array has a first item. @preserve */
	if (definition === undefined) return undefined;
	if (
		definition.type === "Variable" &&
		isVariableDeclarator(definition.node) &&
		isBindingIdentifier(definition.node.id)
	) {
		return definition.node.id.typeAnnotation ?? undefined;
	}
	if (definition.type !== "Parameter") return undefined;
	/* v8 ignore next -- Parameter definitions own function-like nodes. @preserve */
	if (!isFunctionLike(definition.node)) return undefined;

	for (const parameter of definition.node.params) {
		if (getFunctionParameterBindingName(parameter, sourceCode) === variable.name) {
			return getFunctionParameterTypeAnnotation(parameter);
		}
	}
	return undefined;
}

function hasInformativeType(tsType: ESTree.TSType, environment: TypeEnvironment): boolean {
	return classifyUnsafeDictionaryValue(tsType, environment) === undefined;
}

function unwrapCallArgumentExpression(expression: ESTree.Expression): ESTree.Expression {
	let current = expression;
	while (isParenthesizedExpression(current) || isTsNonNullExpression(current) || isTsSatisfiesExpression(current)) {
		current = current.expression;
	}
	return current;
}

function hasKnownCallArgumentEvidence(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	environment: TypeEnvironment,
): boolean {
	const visitedVariables = new Set<ScopeVariable>();
	let current = expression;
	for (;;) {
		current = unwrapCallArgumentExpression(current);
		const assertionEvidence = getAssertionEvidence(current, environment);
		if (assertionEvidence !== undefined) return assertionEvidence;

		if (isCallExpression(current)) {
			const owner = getLocalFunctionForCall(sourceCode, current.callee);
			return hasInformativeReturnType(owner?.returnType?.typeAnnotation, environment);
		}

		if (!isIdentifierReference(current)) return isKnownEvidenceExpression(current);

		const variable = resolveVariable(sourceCode, current);
		if (!isUnvisitedVariable(variable, visitedVariables)) return false;

		const annotation = getVariableTypeAnnotation(sourceCode, variable);
		if (annotation !== undefined) return hasInformativeType(annotation.typeAnnotation, environment);

		const declarator = getVariableDeclarator(variable);
		if (!hasStableInitializer(variable, declarator)) return false;
		visitedVariables.add(variable);
		current = declarator.init;
	}
}

function getTypePredicateSubject(sourceCode: SourceCode, owner: FunctionExpression): PredicateSubject | undefined {
	const predicate = owner.returnType?.typeAnnotation;
	if (!isTsTypePredicate(predicate) || !isBindingIdentifier(predicate.parameterName)) return undefined;

	const predicateParameterName = predicate.parameterName.name;
	let argumentIndex = 0;
	for (const parameter of owner.params) {
		if (isBindingIdentifier(parameter) && parameter.name === "this") continue;
		if (getFunctionParameterBindingName(parameter, sourceCode) === predicateParameterName) {
			return { argumentIndex, parameter };
		}
		argumentIndex += 1;
	}
	return undefined;
}

function annotationTarget(
	annotation: ESTree.TSTypeAnnotation | null | undefined,
	environment: TypeEnvironment,
): undefined | WideningTarget {
	if (annotation === null || annotation === undefined) return undefined;
	return classifyWideningTarget(annotation.typeAnnotation, environment);
}

function getEnclosingFunction(node: ESTree.Node): FunctionExpression | undefined {
	let current: ESTree.Node | null = node.parent;
	while (current !== null && !isProgram(current)) {
		if (isAnyFunction(current)) return current;
		current = current.parent;
	}
	/* v8 ignore next -- top-level returns only occur in script sources this suite does not exercise. @preserve */
	return undefined;
}

function getSourceKeyName(sourceCode: SourceCode, key: ESTree.PropertyKey): string {
	if (isBindingIdentifier(key) || isPrivateIdentifier(key)) return key.name;
	return isAnyLiteral(key) ? String(key.value) : sourceCode.getText(key);
}

const ANONYMOUS = "anonymous function";

function functionName(sourceCode: SourceCode, owner?: FunctionExpression): string {
	/* v8 ignore next 3 -- top-level returns only occur in script sources this suite does not exercise. @preserve */
	if (owner === undefined) return ANONYMOUS;
	if (owner.id !== null) return owner.id.name;

	const { parent } = owner;
	if (isVariableDeclarator(parent) && isBindingIdentifier(parent.id)) return parent.id.name;

	return isMethodDefinition(parent) ? getSourceKeyName(sourceCode, parent.key) : ANONYMOUS;
}

function isEmptyObjectExpression(expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpressionParentheses(expression);
	return isObjectExpression(unwrapped) && unwrapped.properties.length === 0;
}

function isDictionaryAccumulatorTarget(destination: WideningTarget): boolean {
	return destination.kind === "open dictionary" || destination.kind === "generic container";
}

function hasParentAssertion(node: ESTree.Node): boolean {
	let current = node;
	let { parent } = current;
	while (
		parent !== null &&
		(isParenthesizedExpression(parent) || isTsNonNullExpression(parent) || isTsSatisfiesExpression(parent)) &&
		parent.expression === current
	) {
		current = parent;
		({ parent } = current);
	}
	return parent !== null && (isTsAsExpression(parent) || isTsTypeAssertion(parent)) && parent.expression === current;
}

function unwrapExpressionParentheses(expression: ESTree.Expression): ESTree.Expression {
	let current = expression;
	while (
		isParenthesizedExpression(current) ||
		isTsAsExpression(current) ||
		isTsSatisfiesExpression(current) ||
		isTsTypeAssertion(current) ||
		isTsNonNullExpression(current)
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
			destination: undefined | WideningTarget,
			subject: string,
		): void {
			if (destination === undefined) return;
			if (isDictionaryAccumulatorTarget(destination) && isEmptyObjectExpression(expression)) return;
			/* v8 ignore next -- A destination requires the initialized environment. @preserve */
			if (environment === undefined || !hasKnownEvidence(context.sourceCode, expression, environment)) return;

			context.report({
				data: { subject, target: destination.kind },
				messageId: "widening",
				node: expression,
			});
		}

		function targetFromAnnotation(annotation?: ESTree.TSTypeAnnotation | null): undefined | WideningTarget {
			/* v8 ignore next -- the environment is always built by the Program visitor first. @preserve */
			return environment === undefined ? undefined : annotationTarget(annotation, environment);
		}

		return {
			AccessorProperty(node): void {
				/* v8 ignore next -- Visitor keys guarantee AccessorProperty nodes. @preserve */
				if (!isAccessorProperty(node) || node.value === null) return;
				reportFlow(
					node.value,
					targetFromAnnotation(node.typeAnnotation),
					`property \`${getSourceKeyName(context.sourceCode, node.key)}\``,
				);
			},
			ArrowFunctionExpression(node): void {
				if (isBlockStatement(node.body)) return;
				reportFlow(
					node.body,
					targetFromAnnotation(node.returnType),
					`return value of \`${functionName(context.sourceCode, node)}\``,
				);
			},
			AssignmentExpression(node): void {
				if (node.operator !== "=" || !isIdentifierName(node.left)) return;

				const variable = resolveVariable(context.sourceCode, node.left);
				if (variable === undefined) return;

				const binding = getVariableDeclarator(variable)?.id;
				if (!isIdentifierName(binding)) return;
				reportFlow(node.right, targetFromAnnotation(binding.typeAnnotation), `binding \`${binding.name}\``);
			},
			CallExpression(node): void {
				/* v8 ignore next -- The Program visitor initializes this first. @preserve */
				if (environment === undefined) return;

				const owner = getLocalFunctionForCall(context.sourceCode, node.callee);
				if (owner === undefined) return;

				const subject = getTypePredicateSubject(context.sourceCode, owner);
				if (subject === undefined) return;

				const { argumentIndex, parameter } = subject;
				const argument = node.arguments[argumentIndex];
				if (argument === undefined || isSpreadElement(argument)) return;

				const annotation = getFunctionParameterTypeAnnotation(parameter);
				if (annotation === undefined || !containsUnknownType(annotation.typeAnnotation)) return;
				if (!hasKnownCallArgumentEvidence(context.sourceCode, argument, environment)) return;

				context.report({
					data: {
						subject: `argument for parameter \`${getFunctionParameterBindingName(parameter, context.sourceCode)}\` of \`${functionName(context.sourceCode, owner)}\``,
						target: "unknown",
					},
					messageId: "widening",
					node: argument,
				});
			},
			Program(node): void {
				environment = createTypeEnvironment(node, context.sourceCode.visitorKeys);
			},
			PropertyDefinition(node): void {
				if (node.value === null) return;
				reportFlow(
					node.value,
					targetFromAnnotation(node.typeAnnotation),
					`property \`${getSourceKeyName(context.sourceCode, node.key)}\``,
				);
			},
			ReturnStatement(node): void {
				if (node.argument === null) return;
				const owner = getEnclosingFunction(node);
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
				if (environment === undefined || hasParentAssertion(node)) return;
				reportFlow(node.expression, classifyWideningTarget(node.typeAnnotation, environment), "assertion");
			},
			VariableDeclarator(node): void {
				if (node.init === null || !isIdentifierName(node.id)) return;
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
