import { getVariableByName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import {
	DEFAULT_STATIC_GLOBAL_FACTORIES,
	isModuleLevelScope,
	isStaticExpression,
} from "$oxc-utilities/static-expression-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { StaticExpressionOptions } from "$oxc-utilities/static-expression-utilities";
import type { Context, ESTree, Visitor } from "oxlint-plugin-utilities";

const STATIC_OPTIONS: StaticExpressionOptions = {
	staticGlobalFactories: new Set(DEFAULT_STATIC_GLOBAL_FACTORIES),
};

function getAttributeExpression(node: ESTree.JSXAttribute): ESTree.Expression | undefined {
	const { value } = node;
	if (value?.type !== "JSXExpressionContainer") return undefined;
	if (value.expression.type === "JSXEmptyExpression") return undefined;
	return value.expression;
}

type WalkableParent = ESTree.ArrayExpression | ESTree.JSXElement | ESTree.JSXExpressionContainer | ESTree.JSXFragment;

function isJsxElementAssignedToModuleConst(context: Context, node: ESTree.JSXElement | ESTree.JSXFragment): boolean {
	let current: WalkableParent = node;

	while (true) {
		// oxlint-disable-next-line eslint/prefer-destructuring -- incorrect lol
		const parent: ESTree.Node = current.parent;

		if (parent.type === "VariableDeclarator") {
			if (parent.id.type !== "Identifier") return false;
			if (parent.init !== current) return false;

			const scope = context.sourceCode.getScope(node);
			const variable = getVariableByName(scope, parent.id.name);
			if (variable === undefined) return false;

			return isModuleLevelScope(variable.scope);
		}

		if (parent.type === "JSXElement" || parent.type === "JSXFragment") {
			current = parent;
			continue;
		}

		if (parent.type === "JSXExpressionContainer") {
			current = parent;
			continue;
		}

		if (parent.type === "ArrayExpression") {
			current = parent;
			continue;
		}

		return false;
	}
}

function reportHoistableObject(context: Context, objectExpression: ESTree.ObjectExpression): void {
	const objectText = context.sourceCode.getText(objectExpression);
	context.report({
		data: { objectText },
		messageId: "hoistableObjectProp",
		node: objectExpression,
	});
}

function reportHoistableObjectProperties(context: Context, objectExpression: ESTree.ObjectExpression): void {
	if (objectExpression.properties.some((property) => property.type === "Property" && property.computed)) return;

	const seen = new Set<ESTree.Node>();
	if (isStaticExpression(context.sourceCode, objectExpression, seen, STATIC_OPTIONS)) {
		reportHoistableObject(context, objectExpression);
		return;
	}

	for (const property of objectExpression.properties) {
		if (property.type !== "Property") continue;
		const value = unwrapExpression(property.value);
		if (value.type === "ObjectExpression") reportHoistableObjectProperties(context, value);
	}
}

const preferHoistedJsxObjectProperties = defineRule({
	create(context): Visitor {
		return {
			JSXAttribute(node): void {
				const expression = getAttributeExpression(node);
				if (expression === undefined) return;

				const unwrapped = unwrapExpression(expression);
				if (unwrapped.type !== "ObjectExpression") return;

				const openingElement = node.parent;
				if (openingElement.type !== "JSXOpeningElement") return;

				const jsxElement = openingElement.parent;
				if (jsxElement.type === "JSXElement" && isJsxElementAssignedToModuleConst(context, jsxElement)) {
					return;
				}

				reportHoistableObjectProperties(context, unwrapped);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Prefer extracting inline JSX object props to module-level constants when the entire object is statically hoistable.",
		},
		messages: {
			hoistableObjectProp:
				"Extract `{{objectText}}` to a module-level const — this inline JSX prop object is fully static and causes unnecessary reference churn on every render.",
		},
		schema: [],
		type: "suggestion",
	},
});

export default preferHoistedJsxObjectProperties;
