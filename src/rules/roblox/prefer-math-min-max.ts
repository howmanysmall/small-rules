import { Predicate } from "effect";

import { getVariableByName, hasShadowedBinding } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isExpressionSideEffectSafe } from "$oxc-utilities/expression-safety";
import {
	isAnyLiteral,
	isAssignmentPattern,
	isBinaryExpression,
	isBindingIdentifier,
	isIdentifierName,
	isSequenceExpression,
	isTsAsExpression,
	isTsNumberKeyword,
	isTsTypeAnnotation,
	isTsTypeAssertion,
	isTsTypeReference,
	isVariableDeclarator,
	PRIVATE_IDENTIFIER,
	unwrapExpression,
	unwrapParenthesis,
} from "$oxc-utilities/oxc-utilities";

import type { Definition, ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

function isNumberTypeAnnotation(typeAnnotation: ESTree.TSType | ESTree.TSTypeAnnotation | undefined): boolean {
	/* v8 ignore next -- @preserve callers use undefined to mean no type annotation. */
	if (typeAnnotation === undefined) return false;

	let current = typeAnnotation;
	while (isTsTypeAnnotation(current)) current = current.typeAnnotation;
	return (
		isTsNumberKeyword(current) ||
		(isTsTypeReference(current) && isBindingIdentifier(current.typeName) && current.typeName.name === "Number")
	);
}

function isExpressionOperand(node: ESTree.Expression | ESTree.PrivateIdentifier): node is ESTree.Expression {
	/* v8 ignore next -- @preserve binary expressions cannot contain PrivateIdentifier operands in this parser shape. */
	return node.type !== PRIVATE_IDENTIFIER;
}

function isKnownNonNumberLiteral(expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	return isAnyLiteral(unwrapped) && !Predicate.isNumber(unwrapped.value);
}

function isKnownNonNumberDefinition(definition: Definition): boolean {
	if (definition.type === "Parameter") {
		const identifier = definition.name;

		if (identifier.typeAnnotation !== undefined && identifier.typeAnnotation !== null) {
			return !isNumberTypeAnnotation(identifier.typeAnnotation);
		}

		const { parent } = identifier;
		return isAssignmentPattern(parent) && isKnownNonNumberLiteral(parent.right);
	}

	/* v8 ignore next -- @preserve scope definitions reaching identifier expressions are parameters or variables. */
	if (definition.type !== "Variable" || !isVariableDeclarator(definition.node)) return false;

	const { id, init } = definition.node;
	// oxlint-disable-next-line typescript/no-unnecessary-condition -- false flag
	if (isBindingIdentifier(id) && id.typeAnnotation !== undefined && id.typeAnnotation !== null) {
		return !isNumberTypeAnnotation(id.typeAnnotation);
	}

	return init !== null && isKnownNonNumberLiteral(init);
}

function isKnownNonNumberIdentifier(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): boolean {
	const variable = getVariableByName(sourceCode.getScope(identifier), identifier.name);
	if (variable === undefined) return false;

	for (const definition of variable.defs) if (isKnownNonNumberDefinition(definition)) return true;
	return false;
}

function isKnownNonNumberExpression(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	const current = unwrapParenthesis(expression);

	if (isTsAsExpression(current) || isTsTypeAssertion(current)) return !isNumberTypeAnnotation(current.typeAnnotation);

	/* v8 ignore next -- @preserve literal non-number cases are covered by direct literal tests. */
	if (isKnownNonNumberLiteral(current)) return true;

	const unwrapped = unwrapExpression(current);
	return isIdentifierName(unwrapped) && isKnownNonNumberIdentifier(sourceCode, unwrapped);
}

function getComparableText(sourceCode: SourceCode, expression: ESTree.Expression): string {
	return sourceCode.getText(unwrapExpression(expression));
}

function getMathArgumentText(sourceCode: SourceCode, expression: ESTree.Expression): string {
	const unwrapped = unwrapParenthesis(expression);
	if (isSequenceExpression(unwrapped)) return `(${sourceCode.getText(unwrapped)})`;
	return sourceCode.getText(unwrapped);
}

type MathMethod = "max" | "min";

interface BranchMatchOptions {
	readonly alternateText: string;
	readonly consequentText: string;
	readonly isGreaterOrEqual: boolean;
	readonly isLessOrEqual: boolean;
	readonly leftText: string;
	readonly rightText: string;
}

function isMinBranchMatch({
	alternateText,
	consequentText,
	isGreaterOrEqual,
	isLessOrEqual,
	leftText,
	rightText,
}: BranchMatchOptions): boolean {
	if (isGreaterOrEqual && leftText === alternateText && rightText === consequentText) return true;
	return isLessOrEqual && leftText === consequentText && rightText === alternateText;
}

function isMaxBranchMatch({
	alternateText,
	consequentText,
	isGreaterOrEqual,
	isLessOrEqual,
	leftText,
	rightText,
}: BranchMatchOptions): boolean {
	if (isGreaterOrEqual && leftText === consequentText && rightText === alternateText) return true;
	return isLessOrEqual && leftText === alternateText && rightText === consequentText;
}

function hasComparableNumberOperands(
	sourceCode: SourceCode,
	left: ESTree.Expression,
	right: ESTree.Expression,
): boolean {
	if (!isExpressionSideEffectSafe(left) || !isExpressionSideEffectSafe(right)) return false;
	return !isKnownNonNumberExpression(sourceCode, left) && !isKnownNonNumberExpression(sourceCode, right);
}

function getPreferredMathMethod(sourceCode: SourceCode, node: ESTree.ConditionalExpression): MathMethod | undefined {
	if (!isBinaryExpression(node.test)) return undefined;

	const { alternate, consequent, test } = node;
	const { left, operator, right } = test;
	/* v8 ignore next -- @preserve binary expressions cannot contain PrivateIdentifier operands in this parser shape. */
	if (!isExpressionOperand(left) || !isExpressionOperand(right)) return undefined;

	if (!hasComparableNumberOperands(sourceCode, left, right)) return undefined;

	const leftText = getComparableText(sourceCode, left);
	const rightText = getComparableText(sourceCode, right);
	const alternateText = getComparableText(sourceCode, alternate);
	const consequentText = getComparableText(sourceCode, consequent);

	const isGreaterOrEqual = operator === ">" || operator === ">=";
	const isLessOrEqual = operator === "<" || operator === "<=";

	const branchMatchOptions: BranchMatchOptions = {
		alternateText,
		consequentText,
		isGreaterOrEqual,
		isLessOrEqual,
		leftText,
		rightText,
	};

	if (isMinBranchMatch(branchMatchOptions)) return "min";
	if (isMaxBranchMatch(branchMatchOptions)) return "max";
	return undefined;
}

const preferMathMinMax = createRule("prefer-math-min-max", "roblox", {
	create(context): Visitor {
		const { sourceCode } = context;

		return {
			ConditionalExpression(node): void {
				if (hasShadowedBinding(sourceCode, node, "math")) return;

				const method = getPreferredMathMethod(sourceCode, node);
				if (method === undefined || !isBinaryExpression(node.test)) return;

				const { left, right } = node.test;
				/* v8 ignore next -- @preserve getPreferredMathMethod already rejected non-expression operands. */
				if (!isExpressionOperand(left) || !isExpressionOperand(right)) return;
				const leftText = getMathArgumentText(sourceCode, left);
				const rightText = getMathArgumentText(sourceCode, right);

				context.report({
					fix(fixer) {
						return fixer.replaceText(node, `math.${method}(${leftText}, ${rightText})`);
					},
					messageId: "preferMathMethod",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prefer math.min() and math.max() over simple clamp-like ternaries.",
			recommended: true,
		},
		fixable: "code",
		messages: {
			preferMathMethod: "Use `math.min()` or `math.max()` instead of this ternary comparison.",
		},
		schema: [],
		type: "suggestion",
	},
});

export default preferMathMinMax;
