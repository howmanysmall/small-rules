import {
	isArrayPattern,
	isArrowFunctionExpression,
	isAssignmentPattern,
	isFunctionDeclaration,
	isFunctionExpression,
	isIdentifierNamed,
	isMethodDefinitionRaw,
	isObjectPattern,
	isProperty,
	isRestElement,
	isTsParameterProperty,
	isTsParenthesizedType,
	isTsUndefinedKeyword,
	isTsUnionType,
	TS_METHOD_SIGNATURE,
} from "@small-rules/oxlint-utilities";

import {
	getFunctionParameterBindingName,
	getFunctionParameterTypeAnnotation,
} from "$oxc-utilities/anti-slop/function-parameters";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

type ParameterBinding = Exclude<ESTree.ParamPattern, ESTree.TSParameterProperty>;

type ParameterOwner =
	| ESTree.ArrowFunctionExpression
	| ESTree.Function
	| ESTree.TSCallSignatureDeclaration
	| ESTree.TSConstructorType
	| ESTree.TSConstructSignatureDeclaration
	| ESTree.TSFunctionType
	| ESTree.TSMethodSignature;

interface UndefinedUnion {
	readonly annotationType: ESTree.TSType;
	readonly retainedTypes: ReadonlyArray<ESTree.TSType>;
}

function unwrapParameter(parameter: ESTree.ParamPattern): ParameterBinding {
	return isTsParameterProperty(parameter) ? parameter.parameter : parameter;
}

function unwrapParenthesizedType(type: ESTree.TSType): ESTree.TSType {
	let current = type;
	while (isTsParenthesizedType(current)) current = current.typeAnnotation;
	return current;
}

function isOptionalParameter(parameter: ESTree.ParamPattern, sourceCode: SourceCode): boolean {
	const unwrapped = unwrapParameter(parameter);
	if (isAssignmentPattern(unwrapped) || isRestElement(unwrapped)) return true;

	const annotation = getFunctionParameterTypeAnnotation(parameter);
	return annotation !== undefined && sourceCode.getTokenBefore(annotation)?.value === "?";
}

function canFollowOptionalParameter(
	parameters: ReadonlyArray<ESTree.ParamPattern>,
	index: number,
	sourceCode: SourceCode,
): boolean {
	for (let nextIndex = index + 1; nextIndex < parameters.length; nextIndex += 1) {
		const parameter = parameters[nextIndex];
		if (parameter === undefined || !isOptionalParameter(parameter, sourceCode)) return false;
	}
	return true;
}

function isAccessorSetter(owner: ParameterOwner): boolean {
	if (owner.type === TS_METHOD_SIGNATURE) return owner.kind === "set";
	if (!isFunctionExpression(owner)) return false;

	const { parent } = owner;
	if (isMethodDefinitionRaw(parent)) return parent.kind === "set";
	return isProperty(parent) && parent.kind === "set";
}

function isImplementationSignature(owner: ParameterOwner): boolean {
	if (isArrowFunctionExpression(owner)) return true;
	return isFunctionDeclaration(owner) && owner.body !== null;
}

function canUseOptionalBinding(parameter: ESTree.ParamPattern, owner: ParameterOwner): boolean {
	const unwrapped = unwrapParameter(parameter);
	if (!isObjectPattern(unwrapped) && !isArrayPattern(unwrapped)) return true;
	return !isImplementationSignature(owner);
}

function isThisParameter(parameter: ESTree.ParamPattern): boolean {
	return isIdentifierNamed(unwrapParameter(parameter), "this");
}

function getOptionalParameterAnnotation(parameter: ESTree.ParamPattern): ESTree.TSTypeAnnotation | undefined {
	const unwrapped = unwrapParameter(parameter);
	if (isAssignmentPattern(unwrapped) || isRestElement(unwrapped)) return undefined;
	return getFunctionParameterTypeAnnotation(parameter);
}

function splitUndefinedUnion(annotation: ESTree.TSTypeAnnotation): undefined | UndefinedUnion {
	const union = unwrapParenthesizedType(annotation.typeAnnotation);
	if (!isTsUnionType(union)) return undefined;

	const retainedTypes = new Array<ESTree.TSType>();
	let hasUndefined = false;
	for (const member of union.types) {
		if (isTsUndefinedKeyword(unwrapParenthesizedType(member))) {
			hasUndefined = true;
			continue;
		}
		retainedTypes.push(member);
	}

	if (!hasUndefined || retainedTypes.length === 0) return undefined;
	return { annotationType: annotation.typeAnnotation, retainedTypes };
}

const preferOptionalParameter = createRule("prefer-optional-parameter", "naming", {
	createOnce(context): Visitor {
		function checkParameter(
			owner: ParameterOwner,
			parameter: ESTree.ParamPattern,
			index: number,
			sourceCode: SourceCode,
			isSetter: boolean,
		): void {
			if (isThisParameter(parameter)) return;

			const annotation = getOptionalParameterAnnotation(parameter);
			if (annotation === undefined || isOptionalParameter(parameter, sourceCode)) return;

			const undefinedUnion = splitUndefinedUnion(annotation);
			if (undefinedUnion === undefined) return;

			const data = { parameter: getFunctionParameterBindingName(parameter, sourceCode) };
			const isOptionalPositionAllowed =
				!isSetter &&
				canUseOptionalBinding(parameter, owner) &&
				canFollowOptionalParameter(owner.params, index, sourceCode);
			const hasComments = sourceCode.getCommentsInside(annotation.typeAnnotation).length > 0;
			if (!isOptionalPositionAllowed || hasComments) {
				context.report({ data, messageId: "preferOptionalParameter", node: annotation });
				return;
			}

			const replacement = undefinedUnion.retainedTypes.map((member) => sourceCode.getText(member)).join(" | ");
			context.report({
				data,
				fix(fixer) {
					return [
						fixer.insertTextBefore(annotation, "?"),
						fixer.replaceText(undefinedUnion.annotationType, replacement),
					];
				},
				messageId: "preferOptionalParameter",
				node: annotation,
			});
		}

		function checkParameters(owner: ParameterOwner): void {
			const { sourceCode } = context;
			const isSetter = isAccessorSetter(owner);
			for (const [index, parameter] of owner.params.entries()) {
				checkParameter(owner, parameter, index, sourceCode, isSetter);
			}
		}

		return {
			ArrowFunctionExpression: checkParameters,
			FunctionDeclaration: checkParameters,
			FunctionExpression: checkParameters,
			TSCallSignatureDeclaration: checkParameters,
			TSConstructorType: checkParameters,
			TSConstructSignatureDeclaration: checkParameters,
			TSDeclareFunction: checkParameters,
			TSEmptyBodyFunctionExpression: checkParameters,
			TSFunctionType: checkParameters,
			TSMethodSignature: checkParameters,
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow `undefined` in a function parameter's type union; declare the parameter optional with `?` instead.",
		},
		fixable: "code",
		messages: {
			preferOptionalParameter:
				"Parameter `{{parameter}}` includes `undefined` in its type. Declare it optional with `?` instead.",
		},
		schema: [] as const,
		type: "problem",
	},
});

export default preferOptionalParameter;
