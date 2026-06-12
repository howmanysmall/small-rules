import { isNumericLiteral } from "$oxc-utilities/oxc-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isNumericLiteralValue(node: ESTree.Node, value: number): node is ESTree.NumericLiteral {
	return isNumericLiteral(node) && node.value === value;
}

function getSequenceKeypointName(sequenceName: string): string | undefined {
	if (sequenceName === "ColorSequence") return "ColorSequenceKeypoint";
	if (sequenceName === "NumberSequence") return "NumberSequenceKeypoint";
	return undefined;
}

function getKeypointValue(node: ESTree.Expression, keypointName: string, time: number): ESTree.Expression | undefined {
	if (node.type !== "NewExpression") return undefined;
	if (node.callee.type !== "Identifier" || node.callee.name !== keypointName) return undefined;
	if (node.arguments.length !== 2) return undefined;

	const [timeArgument, valueArgument] = node.arguments;
	if (timeArgument === undefined || timeArgument.type === "SpreadElement") return undefined;
	if (valueArgument === undefined || valueArgument.type === "SpreadElement") return undefined;
	return isNumericLiteralValue(timeArgument, time) ? valueArgument : undefined;
}

const preferSequenceOverloads = defineRule({
	create(context): Visitor {
		return {
			NewExpression(node): void {
				if (node.callee.type !== "Identifier") return;

				const sequenceName = node.callee.name;
				const keypointName = getSequenceKeypointName(sequenceName);
				if (keypointName === undefined) return;

				if (node.arguments.length === 2) {
					const [firstArgument, secondArgument] = node.arguments;
					if (firstArgument === undefined || firstArgument.type === "SpreadElement") return;
					if (secondArgument === undefined || secondArgument.type === "SpreadElement") return;

					const firstText = context.sourceCode.getText(firstArgument);
					const secondText = context.sourceCode.getText(secondArgument);
					if (firstText !== secondText) return;

					context.report({
						fix: (fixer) => fixer.replaceText(node, `new ${sequenceName}(${firstText})`),
						messageId: "preferSingleOverload",
						node,
					});
					return;
				}

				if (node.arguments.length !== 1) return;

				const [onlyArgument] = node.arguments;
				if (onlyArgument === undefined || onlyArgument.type === "SpreadElement") return;
				if (onlyArgument.type !== "ArrayExpression" || onlyArgument.elements.length !== 2) return;

				const [firstElement, secondElement] = onlyArgument.elements;
				if (firstElement === undefined || secondElement === undefined) return;
				if (firstElement === null || secondElement === null) return;
				if (firstElement.type === "SpreadElement" || secondElement.type === "SpreadElement") return;

				const firstValue = getKeypointValue(firstElement, keypointName, 0);
				const secondValue = getKeypointValue(secondElement, keypointName, 1);
				if (firstValue === undefined || secondValue === undefined) return;

				const firstText = context.sourceCode.getText(firstValue);
				const secondText = context.sourceCode.getText(secondValue);
				const replacement =
					firstText === secondText
						? `new ${sequenceName}(${firstText})`
						: `new ${sequenceName}(${firstText}, ${secondText})`;

				context.report({
					fix: (fixer) => fixer.replaceText(node, replacement),
					messageId: firstText === secondText ? "preferSingleOverload" : "preferTwoPointOverload",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prefer direct ColorSequence and NumberSequence overloads over two-keypoint arrays.",
			recommended: true,
		},
		fixable: "code",
		messages: {
			preferSingleOverload: "Use the single-value sequence overload instead of two identical keypoints.",
			preferTwoPointOverload: "Use the two-value sequence overload instead of constructing a two-keypoint array.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default preferSequenceOverloads;
