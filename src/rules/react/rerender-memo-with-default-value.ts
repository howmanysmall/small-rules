import { isComponentDeclaration } from "$oxc-utilities/component-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isComponentAssignment } from "$oxc-utilities/lint-utilities";
import {
	isArrayExpression,
	isAssignmentPattern,
	isCallbackFunction,
	isFunctionDeclaration,
	isNode,
	isObjectExpression,
	isObjectPattern,
	isProperty,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

type Context = InferContextFromRule<typeof rerenderMemoWithDefaultValue>;
type ObjectPatternProperty = ESTree.ObjectPattern["properties"][number];

function reportEmptyDefaultValue(context: Context, defaultValue: ESTree.Node): void {
	if (isObjectExpression(defaultValue) && defaultValue.properties.length === 0) {
		context.report({
			messageId: "emptyObjectDefault",
			node: defaultValue,
		});
	}

	if (isArrayExpression(defaultValue) && defaultValue.elements.length === 0) {
		context.report({
			messageId: "emptyArrayDefault",
			node: defaultValue,
		});
	}
}

function checkParameterDefaults(context: Context, parameters: ReadonlyArray<ESTree.ParamPattern>): void {
	for (const parameter of parameters) {
		if (isAssignmentPattern(parameter) && isObjectPattern(parameter.left)) {
			checkObjectPatternDefaults(context, parameter.left);
			/* v8 ignore next -- @preserve assignment pattern defaults are parser expression nodes. */
			if (isNode(parameter.right)) reportEmptyDefaultValue(context, parameter.right);
			continue;
		}

		if (!isObjectPattern(parameter)) continue;
		checkObjectPatternDefaults(context, parameter);
	}
}

function checkObjectPatternDefaults(context: Context, pattern: ESTree.ObjectPattern): void {
	for (const property of pattern.properties) {
		const defaultValue = getPropertyDefaultValue(property);
		if (defaultValue !== undefined) reportEmptyDefaultValue(context, defaultValue);
	}
}

function getPropertyDefaultValue(property: ObjectPatternProperty): ESTree.Node | undefined {
	if (!isProperty(property) || !isAssignmentPattern(property.value)) return undefined;
	const { right } = property.value;
	/* v8 ignore next -- @preserve object pattern defaults are parser expression nodes. */
	return isNode(right) ? right : undefined;
}

function getComponentDeclarationParameters(node: ESTree.Node): ReadonlyArray<ESTree.ParamPattern> | undefined {
	if (!isFunctionDeclaration(node) || !isComponentDeclaration(node)) return undefined;
	return [...node.params];
}
function getComponentAssignmentParameters(node: ESTree.Node): ReadonlyArray<ESTree.ParamPattern> | undefined {
	/* v8 ignore next -- @preserve isComponentAssignment already proves a function initializer. */
	if (!isVariableDeclarator(node) || !isComponentAssignment(node) || node.init === null) return undefined;
	/* v8 ignore next -- @preserve isComponentAssignment already proves a function initializer. */
	if (!isCallbackFunction(node.init)) return undefined;
	return [...node.init.params];
}

const rerenderMemoWithDefaultValue = createRule("rerender-memo-with-default-value", "react", {
	create(context): Visitor {
		return {
			FunctionDeclaration(node): void {
				const parameters = getComponentDeclarationParameters(node);
				if (parameters !== undefined) checkParameterDefaults(context, parameters);
			},
			VariableDeclarator(node): void {
				const parameters = getComponentAssignmentParameters(node);
				if (parameters !== undefined) checkParameterDefaults(context, parameters);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prevent inline empty object and array defaults in component prop destructuring.",
			recommended: true,
		},
		messages: {
			emptyArrayDefault:
				"Default prop value [] creates a new array reference every render — extract to a module-level constant",
			emptyObjectDefault:
				"Default prop value {} creates a new object reference every render — extract to a module-level constant",
		},
		type: "problem",
	} as const,
});

export default rerenderMemoWithDefaultValue;
