import { isMemoCall } from "$oxc-utilities/component-utilities";
import { isJsxOpeningExpression } from "$oxc-utilities/oxc-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const enum InlinePropertyType {
	Array = "array",
	Function = "function",
	Jsx = "JSX",
	Object = "object",
}

function getOpeningElementName(node: ESTree.JSXOpeningElement): string | undefined {
	return node.name.type === "JSXIdentifier" ? node.name.name : undefined;
}
function getInlinePropertyType(node: ESTree.Expression): InlinePropertyType | undefined {
	switch (node.type) {
		case "ArrayExpression":
			return InlinePropertyType.Array;

		case "ArrowFunctionExpression":
		case "FunctionExpression":
			return InlinePropertyType.Function;

		case "JSXElement":
		case "JSXFragment":
			return InlinePropertyType.Jsx;

		case "ObjectExpression":
			return InlinePropertyType.Object;

		default:
			return undefined;
	}
}

const noInlinePropertyOnMemoComponent = defineRule({
	create(context): Visitor {
		const memoizedComponentNames = new Set<string>();

		return {
			JSXAttribute(node): void {
				if (
					node.value?.type !== "JSXExpressionContainer" ||
					node.value.expression.type === "JSXEmptyExpression"
				) {
					return;
				}

				const openingElement = node.parent;
				/* v8 ignore next -- JSXAttribute visitors are reached with JSXOpeningElement parents. @preserve */
				if (!isJsxOpeningExpression(openingElement)) return;

				const componentName = getOpeningElementName(openingElement);
				if (componentName === undefined || !memoizedComponentNames.has(componentName)) return;

				const inlinePropertyType = getInlinePropertyType(node.value.expression);
				if (inlinePropertyType === undefined) return;

				context.report({
					data: { name: componentName, type: inlinePropertyType },
					messageId: "inlineProperty",
					node: node.value.expression,
				});
			},
			VariableDeclarator(node): void {
				if (node.id.type === "Identifier" && node.init !== null && isMemoCall(node.init)) {
					memoizedComponentNames.add(node.id.name);
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prevent inline properties from being passed to memoized components.",
			recommended: true,
		},
		messages: {
			inlineProperty:
				'Inline {{type}} passed to memoized component "{{name}}" — new references cause unnecessary re-renders',
		},
		type: "problem",
	},
});

export default noInlinePropertyOnMemoComponent;
