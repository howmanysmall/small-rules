import {
	isArrayExpression,
	isCallExpression,
	isIdentifier,
	isMemberExpression,
	isNamedGlobalCall,
	isNewExpression,
	isNumericLiteral,
	isSpreadElement,
} from "@small-rules/oxlint-utilities";

import { hasShadowedBinding } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isExpressionSideEffectSafe } from "$oxc-utilities/expression-safety";
import { getListElementText, stripExpressionWrappers, stripParenthesis } from "$oxc-utilities/oxc-utilities";

import type { Context, ESTree, Fix, SourceCode, Visitor } from "oxlint-plugin-utilities";

function isNumericLiteralValue(node: ESTree.Node, value: number): node is ESTree.NumericLiteral {
	return isNumericLiteral(node) && node.value === value;
}

function getSequenceKeypointName(sequenceName: string): string | undefined {
	return sequenceName === "ColorSequence" || sequenceName === "NumberSequence"
		? `${sequenceName}Keypoint`
		: undefined;
}

function getKeypointValue(node: ESTree.Expression, keypointName: string, time: number): ESTree.Expression | undefined {
	if (!isNewExpression(node) || !isNamedGlobalCall(node, keypointName) || node.arguments.length !== 2) {
		return undefined;
	}

	const [timeArgument, valueArgument] = node.arguments;
	/* v8 ignore next -- length was checked above; this only guards malformed AST tuples. @preserve */
	if (
		timeArgument === undefined ||
		valueArgument === undefined ||
		isSpreadElement(timeArgument) ||
		isSpreadElement(valueArgument)
	) {
		return undefined;
	}

	return isNumericLiteralValue(timeArgument, time) ? valueArgument : undefined;
}

const PURE_DATATYPES = new Set(["CFrame", "Color3", "NumberRange", "Rect", "UDim", "UDim2", "Vector2", "Vector3"]);

function getDatatypeReference(call: ESTree.CallExpression | ESTree.NewExpression): ESTree.Expression | undefined {
	if (isNewExpression(call)) return call.callee;
	return isMemberExpression(call.callee) && !call.callee.computed ? call.callee.object : undefined;
}

function appendCallArguments(
	call: ESTree.CallExpression | ESTree.NewExpression,
	worklist: Array<ESTree.Expression>,
): boolean {
	for (const argument of call.arguments) {
		if (isSpreadElement(argument)) return false;
		worklist.push(argument);
	}

	return true;
}

/**
 * Tells whether evaluating an expression twice gives the same value as
 * evaluating it once and using the value twice.
 *
 * Roblox datatype constructors and their static factories are pure, so
 * `Color3.fromRGB(1, 2, 3)` counts. Any other call, such as `math.random()`,
 * does not.
 *
 * @param expression - The expression that would be evaluated once.
 * @param sourceCode - The source code that owns the expression.
 * @returns `true` when sharing one evaluation cannot change behavior.
 */
function isReplayable(expression: ESTree.Expression, sourceCode: SourceCode): boolean {
	const worklist = [expression];
	for (const current of worklist) {
		const unwrapped = stripExpressionWrappers(current);
		if (!isCallExpression(unwrapped) && !isNewExpression(unwrapped)) {
			if (!isExpressionSideEffectSafe(unwrapped)) return false;
			continue;
		}

		const datatype = getDatatypeReference(unwrapped);
		if (
			!isIdentifier(datatype) ||
			!PURE_DATATYPES.has(datatype.name) ||
			hasShadowedBinding(sourceCode, datatype, datatype.name) ||
			!appendCallArguments(unwrapped, worklist)
		) {
			return false;
		}
	}

	return true;
}

interface SequenceReplacement {
	readonly messageId: "preferSingleOverload" | "preferTwoPointOverload";
	/** The fixed code; `undefined` when a fix would change behavior. */
	readonly replacement: string | undefined;
}

function getSingleReplacement(
	sequenceName: string,
	value: ESTree.Expression,
	text: string,
	sourceCode: SourceCode,
): string | undefined {
	return isReplayable(value, sourceCode) ? `new ${sequenceName}(${text})` : undefined;
}

function getDirectArgumentReplacement(
	context: Context,
	node: ESTree.NewExpression,
	sequenceName: string,
): SequenceReplacement | undefined {
	if (node.arguments.length !== 2) return undefined;

	const [firstArgument, secondArgument] = node.arguments;
	/* v8 ignore next -- length was checked above; this only guards malformed AST tuples. @preserve */
	if (
		firstArgument === undefined ||
		secondArgument === undefined ||
		isSpreadElement(firstArgument) ||
		isSpreadElement(secondArgument)
	) {
		return undefined;
	}

	const firstText = getListElementText(context.sourceCode, stripParenthesis(firstArgument));
	const secondText = getListElementText(context.sourceCode, stripParenthesis(secondArgument));
	if (firstText !== secondText) return undefined;

	return {
		messageId: "preferSingleOverload",
		replacement: getSingleReplacement(sequenceName, firstArgument, firstText, context.sourceCode),
	};
}

function getKeypointArrayReplacement(
	context: Context,
	node: ESTree.NewExpression,
	sequenceName: string,
	keypointName: string,
): SequenceReplacement | undefined {
	if (node.arguments.length !== 1) return undefined;

	const [onlyArgument] = node.arguments;
	if (
		onlyArgument === undefined ||
		isSpreadElement(onlyArgument) ||
		!isArrayExpression(onlyArgument) ||
		onlyArgument.elements.length !== 2
	) {
		return undefined;
	}

	const [firstElement, secondElement] = onlyArgument.elements;
	/* v8 ignore next -- @preserve length was checked above; this only guards malformed AST tuples. @preserve */
	if (
		firstElement === undefined ||
		secondElement === undefined ||
		firstElement === null ||
		secondElement === null ||
		isSpreadElement(firstElement) ||
		isSpreadElement(secondElement)
	) {
		return undefined;
	}

	const firstValue = getKeypointValue(firstElement, keypointName, 0);
	const secondValue = getKeypointValue(secondElement, keypointName, 1);
	if (firstValue === undefined || secondValue === undefined) return undefined;

	const firstText = getListElementText(context.sourceCode, stripParenthesis(firstValue));
	const secondText = getListElementText(context.sourceCode, stripParenthesis(secondValue));
	if (firstText === secondText) {
		return {
			messageId: "preferSingleOverload",
			replacement: getSingleReplacement(sequenceName, firstValue, firstText, context.sourceCode),
		};
	}

	return {
		messageId: "preferTwoPointOverload",
		replacement: `new ${sequenceName}(${firstText}, ${secondText})`,
	};
}

const preferSequenceOverloads = createRule("prefer-sequence-overloads", "roblox", {
	createOnce(context): Visitor {
		return {
			NewExpression(node): void {
				if (!isIdentifier(node.callee)) return;

				const sequenceName = node.callee.name;
				const keypointName = getSequenceKeypointName(sequenceName);
				if (keypointName === undefined) return;

				const replacement =
					getDirectArgumentReplacement(context, node, sequenceName) ??
					getKeypointArrayReplacement(context, node, sequenceName, keypointName);

				if (replacement === undefined) return;

				context.report({
					fix(fixer): Fix | undefined {
						return replacement.replacement === undefined
							? undefined
							: fixer.replaceText(node, replacement.replacement);
					},
					messageId: replacement.messageId,
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Prefer direct ColorSequence and NumberSequence overloads over identical direct arguments and two-keypoint arrays.",
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
