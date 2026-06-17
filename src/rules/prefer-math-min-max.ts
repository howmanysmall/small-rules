import { getVariableByName, hasShadowedBinding, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { isExpressionSideEffectSafe } from "$oxc-utilities/expression-safety";
import { isNumberRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

function isNumberTypeAnnotation(typeAnnotation: ESTree.TSType | ESTree.TSTypeAnnotation | undefined): boolean {
	if (typeAnnotation === undefined) return false;
	if (typeAnnotation.type === "TSTypeAnnotation") return isNumberTypeAnnotation(typeAnnotation.typeAnnotation);
	if (typeAnnotation.type === "TSNumberKeyword") return true;

	return (
		typeAnnotation.type === "TSTypeReference" &&
		typeAnnotation.typeName.type === "Identifier" &&
		typeAnnotation.typeName.name === "Number"
	);
}

function isExpressionOperand(node: ESTree.Expression | ESTree.PrivateIdentifier): node is ESTree.Expression {
	return node.type !== "PrivateIdentifier";
}

function isKnownNonNumberLiteral(expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	return unwrapped.type === "Literal" && !isNumberRaw(unwrapped.value);
}

function isKnownNonNumberDefinition(definition: ScopeVariable["defs"][number]): boolean {
	if (definition.type === "Parameter") {
		const identifier = definition.name;

		if (
			identifier.type === "Identifier" &&
			identifier.typeAnnotation !== undefined &&
			identifier.typeAnnotation !== null
		) {
			return !isNumberTypeAnnotation(identifier.typeAnnotation);
		}

		const { parent } = identifier;
		return parent?.type === "AssignmentPattern" && isKnownNonNumberLiteral(parent.right);
	}

	if (definition.type !== "Variable" || definition.node.type !== "VariableDeclarator") return false;

	const { id, init } = definition.node;
	if (id.type === "Identifier" && id.typeAnnotation !== undefined && id.typeAnnotation !== null) {
		return !isNumberTypeAnnotation(id.typeAnnotation);
	}

	return init !== undefined && init !== null && isKnownNonNumberLiteral(init);
}

function isKnownNonNumberIdentifier(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): boolean {
	const variable = getVariableByName(sourceCode.getScope(identifier), identifier.name);
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (isKnownNonNumberDefinition(definition)) return true;
	}

	return false;
}

function isKnownNonNumberExpression(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	if (expression.type === "TSAsExpression" || expression.type === "TSTypeAssertion") {
		return !isNumberTypeAnnotation(expression.typeAnnotation);
	}

	if (isKnownNonNumberLiteral(expression)) return true;

	const unwrapped = unwrapExpression(expression);
	return unwrapped.type === "Identifier" && isKnownNonNumberIdentifier(sourceCode, unwrapped);
}

function getComparableText(sourceCode: SourceCode, expression: ESTree.Expression): string {
	return sourceCode.getText(unwrapExpression(expression));
}

function getMathArgumentText(sourceCode: SourceCode, expression: ESTree.Expression): string {
	if (expression.type === "SequenceExpression") return `(${sourceCode.getText(expression)})`;
	return sourceCode.getText(expression);
}

type MathMethod = "max" | "min";

function getPreferredMathMethod(sourceCode: SourceCode, node: ESTree.ConditionalExpression): MathMethod | undefined {
	if (node.test.type !== "BinaryExpression") return undefined;

	const { alternate, consequent, test } = node;
	const { left, operator, right } = test;
	if (!(isExpressionOperand(left) && isExpressionOperand(right))) return undefined;

	if (!(isExpressionSideEffectSafe(left) && isExpressionSideEffectSafe(right))) return undefined;
	if (isKnownNonNumberExpression(sourceCode, left) || isKnownNonNumberExpression(sourceCode, right)) {
		return undefined;
	}

	const leftText = getComparableText(sourceCode, left);
	const rightText = getComparableText(sourceCode, right);
	const alternateText = getComparableText(sourceCode, alternate);
	const consequentText = getComparableText(sourceCode, consequent);

	const isGreaterOrEqual = operator === ">" || operator === ">=";
	const isLessOrEqual = operator === "<" || operator === "<=";

	if (
		(isGreaterOrEqual && leftText === alternateText && rightText === consequentText) ||
		(isLessOrEqual && leftText === consequentText && rightText === alternateText)
	) {
		return "min";
	}

	if (
		(isGreaterOrEqual && leftText === consequentText && rightText === alternateText) ||
		(isLessOrEqual && leftText === alternateText && rightText === consequentText)
	) {
		return "max";
	}

	return undefined;
}

const preferMathMinMax = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;

		return {
			ConditionalExpression(node): void {
				if (hasShadowedBinding(sourceCode, node, "math")) return;

				const method = getPreferredMathMethod(sourceCode, node);
				if (method === undefined || node.test.type !== "BinaryExpression") return;

				const { left, right } = node.test;
				if (!(isExpressionOperand(left) && isExpressionOperand(right))) return;
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
