// Vendored from src/shared/function-parameters.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to local path aliases and repository type guards;
// replaced upstream's recursive unknown search with an append-only worklist
// (ADR-0001); the binding name is trimmed by annotation range length rather
// than a second `getText` call; `AssignmentPattern.typeAnnotation` is always
// null in the oxc AST, so only the left-hand binding's annotation is
// consulted.

import {
	isAssignmentPattern,
	isBindingIdentifier,
	isRestElement,
	isTsParameterProperty,
	isTsParenthesizedType,
	isTsTypeAnnotation,
	isTsUnionType,
	isTsUnknownKeyword,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

export type FunctionParameter = ESTree.ParamPattern;

/**
 * The subset of `SourceCode` the harness's parsed fixtures can satisfy
 * without a cast.
 */
type SourceCodeWithText = Pick<SourceCode, "getText">;

/**
 * Return whether a type is or contains TypeScript's absorbing unknown type.
 *
 * @param type - The type to inspect.
 * @returns Whether `type` is `unknown`, or a parenthesized or union type that
 *   contains it.
 */
export function containsUnknownType(type: ESTree.TSType): boolean {
	const pending: Array<ESTree.TSType> = [type];
	for (const current of pending) {
		if (isTsUnknownKeyword(current)) return true;
		if (isTsParenthesizedType(current)) {
			// oxlint-disable-next-line small-rules/no-loop-iterable-mutation -- ADR-0001 append-only worklist.
			pending.push(current.typeAnnotation);
			continue;
		}
		if (isTsUnionType(current)) {
			for (const member of current.types) {
				// oxlint-disable-next-line small-rules/no-loop-iterable-mutation -- ADR-0001 append-only worklist.
				pending.push(member);
			}
		}
	}
	return false;
}

/**
 * Return the TypeScript annotation attached to a function parameter or its
 * wrapped binding.
 *
 * @param parameter - A function parameter, unwrapped through parameter
 *   properties, rest elements, and assignment patterns as needed.
 * @returns The annotation, or `undefined` if the parameter is unannotated.
 */
export function functionParameterTypeAnnotation(parameter: FunctionParameter): ESTree.TSTypeAnnotation | undefined {
	let current: ESTree.ParamPattern = parameter;
	while (isTsParameterProperty(current) || isRestElement(current)) {
		if (isTsParameterProperty(current)) {
			current = current.parameter;
			continue;
		}

		if (isTsTypeAnnotation(current.typeAnnotation)) return current.typeAnnotation;
		current = current.argument;
	}

	if (isAssignmentPattern(current)) return current.left.typeAnnotation ?? undefined;
	return current.typeAnnotation ?? undefined;
}

/**
 * Return only a function parameter's local binding, excluding its annotation
 * and default value.
 *
 * @param parameter - A function parameter, unwrapped as in
 *   {@linkcode functionParameterTypeAnnotation}.
 * @param sourceCode - Source text access for parameters whose binding is a
 *   destructuring pattern.
 * @returns The parameter's displayed binding, e.g. `value` or `{ value }`.
 */
export function functionParameterBindingName(parameter: FunctionParameter, sourceCode: SourceCodeWithText): string {
	let current: ESTree.ParamPattern = parameter;
	while (true) {
		if (isTsParameterProperty(current)) {
			current = current.parameter;
			continue;
		}
		if (isAssignmentPattern(current)) {
			current = current.left;
			continue;
		}
		if (isRestElement(current)) {
			current = current.argument;
			continue;
		}
		if (isBindingIdentifier(current)) return current.name;

		const sourceText = sourceCode.getText(current);
		const annotation = functionParameterTypeAnnotation(current);
		if (!isTsTypeAnnotation(annotation)) return sourceText;

		// Yuku parameter nodes span their type annotation, so trimming the
		// annotation's range length off the end always yields the displayed
		// name; a second `getText` call would be redundant.
		return sourceText.slice(0, sourceText.length - (annotation.range[1] - annotation.range[0])).trimEnd();
	}
}
