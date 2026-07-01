import { isNamedGlobalCall, isNumericLiteral } from "$oxc-utilities/oxc-utilities";
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
	if (!isNamedGlobalCall(node, keypointName)) return undefined;
	if (node.arguments.length !== 2) return undefined;

	const [timeArgument, valueArgument] = node.arguments;
	/* v8 ignore next -- @preserve length was checked above; this only guards malformed AST tuples. */
	if (timeArgument === undefined || timeArgument.type === "SpreadElement") return undefined;
	/* v8 ignore next -- @preserve length was checked above; this only guards malformed AST tuples. */
	if (valueArgument === undefined || valueArgument.type === "SpreadElement") return undefined;
	return isNumericLiteralValue(timeArgument, time) ? valueArgument : undefined;
}

interface SequenceReplacement {
	readonly messageId: "preferSingleOverload" | "preferTwoPointOverload";
	readonly replacement: string;
}

function getDirectArgumentReplacement(
	context: { sourceCode: { getText: (node: ESTree.Node) => string } },
	node: ESTree.NewExpression,
	sequenceName: string,
): SequenceReplacement | undefined {
	if (node.arguments.length !== 2) return undefined;

	const [firstArgument, secondArgument] = node.arguments;
	/* v8 ignore next -- @preserve length was checked above; this only guards malformed AST tuples. */
	if (firstArgument === undefined || firstArgument.type === "SpreadElement") return undefined;
	/* v8 ignore next -- @preserve length was checked above; this only guards malformed AST tuples. */
	if (secondArgument === undefined || secondArgument.type === "SpreadElement") return undefined;

	const firstText = context.sourceCode.getText(firstArgument);
	const secondText = context.sourceCode.getText(secondArgument);
	if (firstText !== secondText) return undefined;

	return {
		messageId: "preferSingleOverload",
		replacement: `new ${sequenceName}(${firstText})`,
	};
}

function getKeypointArrayReplacement(
	context: { sourceCode: { getText: (node: ESTree.Node) => string } },
	node: ESTree.NewExpression,
	sequenceName: string,
	keypointName: string,
): SequenceReplacement | undefined {
	if (node.arguments.length !== 1) return undefined;

	const [onlyArgument] = node.arguments;
	if (onlyArgument === undefined || onlyArgument.type === "SpreadElement") return undefined;
	if (onlyArgument.type !== "ArrayExpression" || onlyArgument.elements.length !== 2) return undefined;

	const [firstElement, secondElement] = onlyArgument.elements;
	/* v8 ignore next -- @preserve length was checked above; this only guards malformed AST tuples. */
	if (firstElement === undefined || secondElement === undefined) return undefined;
	if (firstElement === null || secondElement === null) return undefined;
	if (firstElement.type === "SpreadElement" || secondElement.type === "SpreadElement") return undefined;

	const firstValue = getKeypointValue(firstElement, keypointName, 0);
	const secondValue = getKeypointValue(secondElement, keypointName, 1);
	if (firstValue === undefined || secondValue === undefined) return undefined;

	const firstText = context.sourceCode.getText(firstValue);
	const secondText = context.sourceCode.getText(secondValue);
	return {
		messageId: firstText === secondText ? "preferSingleOverload" : "preferTwoPointOverload",
		replacement:
			firstText === secondText
				? `new ${sequenceName}(${firstText})`
				: `new ${sequenceName}(${firstText}, ${secondText})`,
	};
}

const preferSequenceOverloads = defineRule({
	createOnce(context): Visitor {
		return {
			NewExpression(node): void {
				if (node.callee.type !== "Identifier") return;

				const sequenceName = node.callee.name;
				const keypointName = getSequenceKeypointName(sequenceName);
				if (keypointName === undefined) return;

				const replacement =
					getDirectArgumentReplacement(context, node, sequenceName) ??
					getKeypointArrayReplacement(context, node, sequenceName, keypointName);
				if (replacement === undefined) return;

				context.report({
					fix: (fixer) => fixer.replaceText(node, replacement.replacement),
					messageId: replacement.messageId,
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
