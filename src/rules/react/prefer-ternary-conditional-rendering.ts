import { createRule } from "$oxc-utilities/create-rule";
import {
	BINARY_EXPRESSION,
	CALL_EXPRESSION,
	IDENTIFIER,
	isAnyLiteral,
	isBinaryExpression,
	isCallExpression,
	isExpressionNode,
	isIdentifier,
	isJsxElement,
	isJsxEmptyExpression,
	isJsxExpressionContainer,
	isJsxFragment,
	isJsxText,
	isLogicalExpression,
	isMemberExpression,
	isPrivateIdentifier,
	isSpreadElement,
	isSuper,
	isThisExpression,
	isUnaryExpression,
	LITERAL,
	LOGICAL_EXPRESSION,
	MEMBER_EXPRESSION,
	stripExpressionWrappers,
	THIS_EXPRESSION,
	UNARY_EXPRESSION,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

type JSXRenderable = ESTree.JSXElement | ESTree.JSXFragment;
type BinaryOperand = ESTree.Expression | ESTree.PrivateIdentifier;

interface BranchCandidate {
	readonly condition: ESTree.Expression;
	readonly logical: ESTree.LogicalExpression;
	readonly node: ESTree.JSXExpressionContainer;
	readonly renderBranch: JSXRenderable;
}

interface StrictComparison {
	readonly left: BinaryOperand;
	readonly operator: "!==" | "===";
	readonly right: BinaryOperand;
}

interface ComplementMatch {
	readonly isFixSafe: boolean;
}

function canRender(node: ESTree.Node): node is JSXRenderable {
	return isJsxElement(node) || isJsxFragment(node);
}

function areEquivalentExpressionOrSuper(
	left: ESTree.Expression | ESTree.Super,
	right: ESTree.Expression | ESTree.Super,
	sourceCode: SourceCode,
): boolean {
	const isLeftSuper = isSuper(left);
	const isRightSuper = isSuper(right);
	if (isLeftSuper || isRightSuper) return isLeftSuper && isRightSuper;

	return areEquivalentExpression(left, right, sourceCode);
}

function areEquivalentArgument(left: ESTree.Argument, right: ESTree.Argument, sourceCode: SourceCode): boolean {
	if (isSpreadElement(left) || isSpreadElement(right)) {
		if (!isSpreadElement(left) || !isSpreadElement(right)) return false;
		return areEquivalentExpression(left.argument, right.argument, sourceCode);
	}

	return areEquivalentExpression(left, right, sourceCode);
}

function areEquivalentOperand(left: BinaryOperand, right: BinaryOperand, sourceCode: SourceCode): boolean {
	const isLeftPrivate = isPrivateIdentifier(left);
	const isRightPrivate = isPrivateIdentifier(right);
	if (isLeftPrivate || isRightPrivate) {
		return isLeftPrivate && isRightPrivate && left.name === right.name;
	}

	return areEquivalentExpression(left, right, sourceCode);
}

function areEquivalentExpression(left: ESTree.Expression, right: ESTree.Expression, sourceCode: SourceCode): boolean {
	const normalizedLeft = stripExpressionWrappers(left);
	const normalizedRight = stripExpressionWrappers(right);
	if (normalizedLeft.type !== normalizedRight.type) return false;

	switch (normalizedLeft.type) {
		case BINARY_EXPRESSION: {
			return (
				isBinaryExpression(normalizedRight) && areEquivalentBinary(normalizedLeft, normalizedRight, sourceCode)
			);
		}

		case CALL_EXPRESSION: {
			return isCallExpression(normalizedRight) && areEquivalentCall(normalizedLeft, normalizedRight, sourceCode);
		}

		case IDENTIFIER:
			return isIdentifier(normalizedRight) && normalizedLeft.name === normalizedRight.name;

		case LITERAL:
			return isAnyLiteral(normalizedRight) && normalizedLeft.value === normalizedRight.value;

		case LOGICAL_EXPRESSION: {
			return (
				isLogicalExpression(normalizedRight) &&
				areEquivalentLogical(normalizedLeft, normalizedRight, sourceCode)
			);
		}

		case MEMBER_EXPRESSION: {
			return (
				isMemberExpression(normalizedRight) && areEquivalentMember(normalizedLeft, normalizedRight, sourceCode)
			);
		}

		case THIS_EXPRESSION:
			return isThisExpression(normalizedRight);

		case UNARY_EXPRESSION: {
			return (
				isUnaryExpression(normalizedRight) &&
				normalizedLeft.operator === normalizedRight.operator &&
				areEquivalentExpression(normalizedLeft.argument, normalizedRight.argument, sourceCode)
			);
		}

		default:
			return sourceCode.getText(normalizedLeft) === sourceCode.getText(normalizedRight);
	}
}

function areEquivalentBinary(
	left: ESTree.BinaryExpression | ESTree.PrivateInExpression,
	right: ESTree.BinaryExpression | ESTree.PrivateInExpression,
	sourceCode: SourceCode,
): boolean {
	return (
		left.operator === right.operator &&
		areEquivalentOperand(left.left, right.left, sourceCode) &&
		areEquivalentOperand(left.right, right.right, sourceCode)
	);
}

function areEquivalentCall(left: ESTree.CallExpression, right: ESTree.CallExpression, sourceCode: SourceCode): boolean {
	if (left.optional !== right.optional) return false;
	if (!areEquivalentExpressionOrSuper(left.callee, right.callee, sourceCode)) return false;
	if (left.arguments.length !== right.arguments.length) return false;

	for (let index = 0; index < left.arguments.length; index += 1) {
		const leftArgument = left.arguments[index];
		const rightArgument = right.arguments[index];
		/* v8 ignore next -- loop bounds ensure dense argument arrays on both parser-produced call nodes. @preserve */
		if (leftArgument === undefined || rightArgument === undefined) return false;
		if (!areEquivalentArgument(leftArgument, rightArgument, sourceCode)) return false;
	}

	return true;
}

function areEquivalentLogical(
	left: ESTree.LogicalExpression,
	right: ESTree.LogicalExpression,
	sourceCode: SourceCode,
): boolean {
	return (
		left.operator === right.operator &&
		areEquivalentExpression(left.left, right.left, sourceCode) &&
		areEquivalentExpression(left.right, right.right, sourceCode)
	);
}

function areEquivalentMember(
	left: ESTree.MemberExpression,
	right: ESTree.MemberExpression,
	sourceCode: SourceCode,
): boolean {
	if (left.computed !== right.computed || left.optional !== right.optional) return false;
	if (!areEquivalentExpressionOrSuper(left.object, right.object, sourceCode)) return false;
	return left.computed
		? areEquivalentOperand(left.property, right.property, sourceCode)
		: areEquivalentStaticMemberProperty(left.property, right.property);
}

function areEquivalentStaticMemberProperty(left: BinaryOperand, right: BinaryOperand): boolean {
	if (isIdentifier(left) && isIdentifier(right)) return left.name === right.name;
	return isPrivateIdentifier(left) && isPrivateIdentifier(right) && left.name === right.name;
}

function getNegatedExpression(expression: ESTree.Expression): ESTree.Expression | undefined {
	const normalized = stripExpressionWrappers(expression);
	if (!isUnaryExpression(normalized) || normalized.operator !== "!") return undefined;
	return stripExpressionWrappers(normalized.argument);
}

function getStrictComparison(expression: ESTree.Expression): StrictComparison | undefined {
	const normalized = stripExpressionWrappers(expression);
	if (!isBinaryExpression(normalized)) return undefined;
	if (normalized.operator !== "===" && normalized.operator !== "!==") return undefined;

	return {
		left: normalized.left,
		operator: normalized.operator,
		right: normalized.right,
	};
}

function isSafeAtom(expression: ESTree.Expression): boolean {
	const normalized = stripExpressionWrappers(expression);
	return isIdentifier(normalized) || isThisExpression(normalized) || isAnyLiteral(normalized);
}

function isSafeOperand(operand: BinaryOperand): boolean {
	return isExpressionNode(operand) && isSafeAtom(operand);
}

function getComplementMatch(
	firstCondition: ESTree.Expression,
	secondCondition: ESTree.Expression,
	sourceCode: SourceCode,
): ComplementMatch | undefined {
	const firstNegated = getNegatedExpression(firstCondition);
	if (firstNegated && areEquivalentExpression(firstNegated, secondCondition, sourceCode)) {
		return { isFixSafe: isSafeAtom(firstNegated) };
	}

	const secondNegated = getNegatedExpression(secondCondition);
	if (secondNegated && areEquivalentExpression(secondNegated, firstCondition, sourceCode)) {
		return { isFixSafe: isSafeAtom(secondNegated) };
	}

	const firstComparison = getStrictComparison(firstCondition);
	const secondComparison = getStrictComparison(secondCondition);
	if (!firstComparison || !secondComparison) return undefined;

	const operatorsComplement =
		(firstComparison.operator === "===" && secondComparison.operator === "!==") ||
		(firstComparison.operator === "!==" && secondComparison.operator === "===");
	if (!operatorsComplement) return undefined;

	const directMatch =
		areEquivalentOperand(firstComparison.left, secondComparison.left, sourceCode) &&
		areEquivalentOperand(firstComparison.right, secondComparison.right, sourceCode);
	const swappedMatch =
		areEquivalentOperand(firstComparison.left, secondComparison.right, sourceCode) &&
		areEquivalentOperand(firstComparison.right, secondComparison.left, sourceCode);

	if (!directMatch && !swappedMatch) return undefined;

	return {
		isFixSafe:
			isSafeOperand(firstComparison.left) &&
			isSafeOperand(firstComparison.right) &&
			isSafeOperand(secondComparison.left) &&
			isSafeOperand(secondComparison.right),
	};
}

function isWhitespaceText(child: ESTree.JSXChild): boolean {
	return isJsxText(child) && child.value.trim() === "";
}

function getBranchCandidate(child: ESTree.JSXChild): BranchCandidate | undefined {
	if (!isJsxExpressionContainer(child) || isJsxEmptyExpression(child.expression)) return undefined;
	if (!isLogicalExpression(child.expression)) return undefined;
	if (child.expression.operator !== "&&" || !canRender(child.expression.right)) return undefined;

	return {
		condition: child.expression.left,
		logical: child.expression,
		node: child,
		renderBranch: child.expression.right,
	};
}

function getNextBranchCandidate(
	children: ReadonlyArray<ESTree.JSXChild>,
	startIndex: number,
): BranchCandidate | undefined {
	let nextIndex = startIndex;
	while (nextIndex < children.length) {
		const whitespaceCandidate = children[nextIndex];
		if (whitespaceCandidate === undefined || !isWhitespaceText(whitespaceCandidate)) break;
		nextIndex += 1;
	}

	const child = children[nextIndex];
	return child === undefined ? undefined : getBranchCandidate(child);
}

const preferTernaryConditionalRendering = createRule("prefer-ternary-conditional-rendering", "react", {
	create(context): Visitor {
		const { sourceCode } = context;

		function reportComplementaryBranches(firstBranch: BranchCandidate, secondBranch: BranchCandidate): void {
			const complement = getComplementMatch(firstBranch.condition, secondBranch.condition, sourceCode);
			if (complement === undefined) return;

			if (complement.isFixSafe) {
				context.report({
					fix(fixer) {
						const firstConditionText = sourceCode.getText(firstBranch.condition);
						const firstBranchText = sourceCode.getText(firstBranch.renderBranch);
						const secondBranchText = sourceCode.getText(secondBranch.renderBranch);
						const replacement = `{${firstConditionText} ? ${firstBranchText} : ${secondBranchText}}`;

						return fixer.replaceTextRange(
							[firstBranch.node.range[0], secondBranch.node.range[1]],
							replacement,
						);
					},
					messageId: "preferTernaryConditionalRendering",
					node: firstBranch.logical,
				});
				return;
			}

			context.report({
				messageId: "preferTernaryConditionalRendering",
				node: firstBranch.logical,
			});
		}

		function inspectChildren(children: ReadonlyArray<ESTree.JSXChild>): void {
			for (let index = 0; index < children.length; index += 1) {
				const firstChild = children[index];
				/* v8 ignore next -- JSX children arrays are dense under parser traversal. @preserve */
				if (firstChild === undefined) continue;

				const firstBranch = getBranchCandidate(firstChild);
				if (firstBranch === undefined) continue;

				const secondBranch = getNextBranchCandidate(children, index + 1);
				if (secondBranch !== undefined) reportComplementaryBranches(firstBranch, secondBranch);
			}
		}

		return {
			JSXElement(node): void {
				inspectChildren(node.children);
			},
			JSXFragment(node): void {
				inspectChildren(node.children);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prefer ternary expressions over complementary JSX && branches.",
		},
		fixable: "code",
		messages: {
			preferTernaryConditionalRendering:
				"Use a single ternary expression instead of complementary JSX && branches.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default preferTernaryConditionalRendering;
