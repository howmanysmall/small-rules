import { isComponentDeclaration } from "$oxc-utilities/component-utilities";
import { isComponentAssignment } from "$oxc-utilities/lint-utilities";
import { isNode } from "$oxc-utilities/oxc-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

type Context = InferContextFromRule<typeof rerenderMemoWithDefaultValue>;

function reportEmptyDefaultValue(context: Context, defaultValue: ESTree.Node): void {
	if (defaultValue.type === "ObjectExpression" && defaultValue.properties.length === 0) {
		context.report({
			messageId: "emptyObjectDefault",
			node: defaultValue,
		});
	}

	if (defaultValue.type === "ArrayExpression" && defaultValue.elements.length === 0) {
		context.report({
			messageId: "emptyArrayDefault",
			node: defaultValue,
		});
	}
}

function checkParameterDefaults(context: Context, parameters: ReadonlyArray<ESTree.ParamPattern>): void {
	for (const parameter of parameters) {
		if (parameter.type === "AssignmentPattern" && parameter.left.type === "ObjectPattern") {
			if (isNode(parameter.right)) reportEmptyDefaultValue(context, parameter.right);

			for (const property of parameter.left.properties) {
				if (property.type !== "Property" || property.value.type !== "AssignmentPattern") continue;

				const defaultValue = property.value.right;
				if (isNode(defaultValue)) reportEmptyDefaultValue(context, defaultValue);
			}

			continue;
		}

		if (parameter.type !== "ObjectPattern") continue;
		for (const property of parameter.properties) {
			if (property.type !== "Property" || property.value.type !== "AssignmentPattern") continue;

			const defaultValue = property.value.right;
			if (!isNode(defaultValue)) continue;

			reportEmptyDefaultValue(context, defaultValue);
		}
	}
}

function getComponentDeclarationParameters(node: ESTree.Node): ReadonlyArray<ESTree.ParamPattern> | undefined {
	if (node.type !== "FunctionDeclaration" || !isComponentDeclaration(node)) return undefined;
	return [...node.params];
}
function getComponentAssignmentParameters(node: ESTree.Node): ReadonlyArray<ESTree.ParamPattern> | undefined {
	if (node.type !== "VariableDeclarator" || !isComponentAssignment(node) || node.init === null) return undefined;
	if (node.init.type !== "ArrowFunctionExpression" && node.init.type !== "FunctionExpression") return undefined;
	return [...node.init.params];
}

const rerenderMemoWithDefaultValue = defineRule({
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
