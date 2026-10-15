// Vendored from src/rules/no-reduce-accumulator-copy.ts@c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases. Reducer callbacks are tracked on a function stack instead of climbing
// ancestors per call, alias chains are walked iteratively, and upstream's
// src/shared/array-method.ts helpers map onto the shared AST utilities.

import {
	isArrayExpression,
	isAssignmentPattern,
	isBindingIdentifier,
	isCallbackFunction,
	isCallExpression,
	isIdentifier,
	isIdentifierNamed,
	isIdentifierReference,
	isMemberExpression,
	isNotSpread,
	isObjectExpression,
	isTsArrayType,
	isTsTupleType,
	isTsTypeOperator,
	isTsTypeReference,
	isVariableDeclarator,
} from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";

import { getReferencedVariable, hasShadowedBinding, hasUninitializedWrite } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { getMemberPropertyName, stripExpressionWrappers, stripParenthesizedType } from "$oxc-utilities/oxc-utilities";
import { getConstInitializer } from "$oxc-utilities/static-expression-utilities";

import type { ESTree, SourceCode, Variable, Visitor } from "oxlint-plugin-utilities";

interface ReducerFrame {
	readonly accumulator: ESTree.BindingIdentifier;
	readonly hasArrayInitialValue: boolean;
}

const REDUCE_METHODS = new Set(["reduce", "reduceRight"]);
const ARRAY_COPY_METHODS = new Set(["concat", "slice", "toReversed", "toSorted", "toSpliced", "with"]);
const ARRAY_PRODUCING_METHODS = new Set([
	"concat",
	"filter",
	"flatMap",
	"map",
	"slice",
	"toReversed",
	"toSorted",
	"toSpliced",
]);
const ARRAY_TYPE_NAMES = new Set(["Array", "ReadonlyArray"]);

const visitedVariables = new Set<Variable>();

function getStaticMember(callee: ESTree.Expression): ESTree.MemberExpression | undefined {
	const member = stripExpressionWrappers(callee);
	return isMemberExpression(member) ? member : undefined;
}

function getConstAliasInitializer(variable: Variable): ESTree.Expression | undefined {
	for (const definition of variable.defs) {
		const initializer = getConstInitializer(definition);
		if (
			initializer !== undefined &&
			isVariableDeclarator(definition.node) &&
			isBindingIdentifier(definition.node.id)
		) {
			return initializer;
		}
	}
	return undefined;
}

function getVariableAnnotation(variable: Variable): ESTree.TSType | undefined {
	for (const identifier of variable.identifiers) {
		const annotation = identifier.typeAnnotation?.typeAnnotation;
		if (annotation !== undefined) return annotation;
	}
	return undefined;
}

function isArrayAnnotation(type: ESTree.TSType): boolean {
	let current = stripParenthesizedType(type);
	while (isTsTypeOperator(current) && current.operator === "readonly") {
		current = stripParenthesizedType(current.typeAnnotation);
	}
	if (isTsArrayType(current) || isTsTupleType(current)) return true;
	return isTsTypeReference(current) && isIdentifier(current.typeName) && ARRAY_TYPE_NAMES.has(current.typeName.name);
}

function getArrayProducingReceiver(call: ESTree.CallExpression): ESTree.Expression | undefined {
	const member = getStaticMember(call.callee);
	if (member === undefined) return undefined;
	const name = getMemberPropertyName(member);
	return name !== undefined && ARRAY_PRODUCING_METHODS.has(name) ? member.object : undefined;
}

/**
 * Settles a binding's array evidence or finds the initializer to follow.
 * @param variable - The binding an identifier resolved to, if any.
 * @returns Whether the binding is an array, or the alias initializer next.
 */
function getBindingArrayEvidence(variable: undefined | Variable): boolean | ESTree.Expression {
	if (variable === undefined || visitedVariables.has(variable) || hasUninitializedWrite(variable)) return false;
	visitedVariables.add(variable);

	const annotation = getVariableAnnotation(variable);
	if (annotation !== undefined) return isArrayAnnotation(annotation);
	return getConstAliasInitializer(variable) ?? false;
}

function getArrayEvidence(sourceCode: SourceCode, expression: ESTree.Expression): boolean | ESTree.Expression {
	const unwrapped = stripExpressionWrappers(expression);
	if (isArrayExpression(unwrapped)) return true;
	if (isCallExpression(unwrapped)) return getArrayProducingReceiver(unwrapped) ?? false;
	if (!isIdentifierReference(unwrapped)) return false;
	return getBindingArrayEvidence(getReferencedVariable(sourceCode, unwrapped));
}

function isKnownArrayExpression(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	visitedVariables.clear();
	let evidence = getArrayEvidence(sourceCode, expression);
	while (!Predicate.isBoolean(evidence)) evidence = getArrayEvidence(sourceCode, evidence);
	return evidence;
}

function declaresBinding(variable: Variable, binding: ESTree.BindingIdentifier): boolean {
	for (const identifier of variable.identifiers) if (identifier.start === binding.start) return true;
	return false;
}

function referencesAccumulator(
	sourceCode: SourceCode,
	argument: ESTree.Argument,
	accumulator: ESTree.BindingIdentifier,
): boolean {
	if (!isNotSpread(argument)) return false;
	visitedVariables.clear();
	let current = argument;
	while (true) {
		const unwrapped = stripExpressionWrappers(current);
		if (!isIdentifierReference(unwrapped)) return false;

		const variable = getReferencedVariable(sourceCode, unwrapped);
		if (variable === undefined) return false;
		if (declaresBinding(variable, accumulator)) return true;
		if (visitedVariables.has(variable)) return false;
		visitedVariables.add(variable);

		const initializer = getConstAliasInitializer(variable);
		if (initializer === undefined) return false;
		current = initializer;
	}
}

function isGlobalNamed(sourceCode: SourceCode, expression: ESTree.Expression, name: string): boolean {
	const unwrapped = stripExpressionWrappers(expression);
	return isIdentifierNamed(unwrapped, name) && !hasShadowedBinding(sourceCode, unwrapped, name);
}

function createReducerFrame(
	sourceCode: SourceCode,
	node: ESTree.CallExpression,
): [ESTree.Node, ReducerFrame] | undefined {
	if (node.arguments.length > 2) return undefined;
	const [callbackArgument, initialValue] = node.arguments;
	if (callbackArgument === undefined || !isNotSpread(callbackArgument)) return undefined;

	const callback = stripExpressionWrappers(callbackArgument);
	if (!isCallbackFunction(callback)) return undefined;

	const [parameter] = callback.params;
	if (parameter === undefined) return undefined;
	const binding = isAssignmentPattern(parameter) ? parameter.left : parameter;
	if (!isBindingIdentifier(binding)) return undefined;

	const hasArrayInitialValue =
		initialValue !== undefined && isNotSpread(initialValue) && isKnownArrayExpression(sourceCode, initialValue);
	return [callback, { accumulator: binding, hasArrayInitialValue }];
}

function copiesIntoFreshObject(
	sourceCode: SourceCode,
	node: ESTree.CallExpression,
	accumulator: ESTree.BindingIdentifier,
): boolean {
	const [target] = node.arguments;
	if (target === undefined || !isNotSpread(target) || !isObjectExpression(stripExpressionWrappers(target))) {
		return false;
	}
	for (let index = 1; index < node.arguments.length; index += 1) {
		const source = node.arguments[index];
		if (source !== undefined && referencesAccumulator(sourceCode, source, accumulator)) return true;
	}
	return false;
}

function isAccumulatorCopy(
	sourceCode: SourceCode,
	node: ESTree.CallExpression,
	member: ESTree.MemberExpression,
	name: string,
	frame: ReducerFrame,
): boolean {
	if (name === "assign" && isGlobalNamed(sourceCode, member.object, "Object")) {
		return copiesIntoFreshObject(sourceCode, node, frame.accumulator);
	}
	if (name === "from" && isGlobalNamed(sourceCode, member.object, "Array")) {
		const [source] = node.arguments;
		return source !== undefined && referencesAccumulator(sourceCode, source, frame.accumulator);
	}
	return (
		frame.hasArrayInitialValue &&
		ARRAY_COPY_METHODS.has(name) &&
		referencesAccumulator(sourceCode, member.object, frame.accumulator)
	);
}

const noReduceAccumulatorCopy = createRule("no-reduce-accumulator-copy", "anti-slop", {
	createOnce(context): Visitor {
		const reducerFrames = new Map<ESTree.Node, ReducerFrame>();
		const functionFrames: Array<ReducerFrame | undefined> = [];

		function enterFunction(node: ESTree.Node): void {
			functionFrames.push(reducerFrames.get(node));
		}

		function exitFunction(): void {
			functionFrames.pop();
		}

		return {
			ArrowFunctionExpression: enterFunction,
			"ArrowFunctionExpression:exit": exitFunction,
			before(): void {
				reducerFrames.clear();
				functionFrames.length = 0;
			},
			CallExpression(node): void {
				const member = getStaticMember(node.callee);
				if (member === undefined) return;
				const name = getMemberPropertyName(member);
				if (name === undefined) return;

				if (REDUCE_METHODS.has(name)) {
					const reducer = createReducerFrame(context.sourceCode, node);
					if (reducer !== undefined) reducerFrames.set(reducer[0], reducer[1]);
					return;
				}

				const frame = functionFrames.at(-1);
				if (frame !== undefined && isAccumulatorCopy(context.sourceCode, node, member, name, frame)) {
					context.report({ messageId: "accumulatorCopy", node });
				}
			},
			FunctionDeclaration: enterFunction,
			"FunctionDeclaration:exit": exitFunction,
			FunctionExpression: enterFunction,
			"FunctionExpression:exit": exitFunction,
		};
	},
	meta: {
		docs: {
			description:
				"Disallow copying growing reducer accumulators with Object.assign, Array.from, or array copy methods.",
			recommended: true,
		},
		messages: {
			accumulatorCopy:
				"Do not copy the reducer accumulator on every iteration; growing copies can cause quadratic work. Mutate a fresh, locally owned accumulator and return it, or use an iterator pipeline or flatMap.",
		},
		type: "problem",
	},
});

export default noReduceAccumulatorCopy;
