import { isMemoCall } from "$oxc-utilities/component-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	ARRAY_EXPRESSION,
	ARROW_FUNCTION_EXPRESSION,
	FUNCTION_EXPRESSION,
	isIdentifierName,
	isJsxEmptyExpression,
	isJsxExpressionContainer,
	isJsxIdentifier,
	isJsxOpeningElement,
	JSX_ELEMENT,
	JSX_FRAGMENT,
	OBJECT_EXPRESSION,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const enum InlinePropertyType {
	Array = "array",
	Function = "function",
	Jsx = "JSX",
	Object = "object",
}

function getOpeningElementName(node: ESTree.JSXOpeningElement): string | undefined {
	return isJsxIdentifier(node.name) ? node.name.name : undefined;
}
function getInlinePropertyType(node: ESTree.Expression): InlinePropertyType | undefined {
	switch (node.type) {
		case ARRAY_EXPRESSION:
			return InlinePropertyType.Array;

		case ARROW_FUNCTION_EXPRESSION:
		case FUNCTION_EXPRESSION:
			return InlinePropertyType.Function;

		case JSX_ELEMENT:
		case JSX_FRAGMENT:
			return InlinePropertyType.Jsx;

		case OBJECT_EXPRESSION:
			return InlinePropertyType.Object;

		default:
			return undefined;
	}
}

const noInlinePropertyOnMemoComponent = createRule("no-inline-property-on-memo-component", "react", {
	create(context): Visitor {
		const memoizedComponentNames = new Set<string>();

		return {
			JSXAttribute(node): void {
				if (!isJsxExpressionContainer(node.value) || isJsxEmptyExpression(node.value.expression)) return;

				const openingElement = node.parent;
				/* v8 ignore next -- JSXAttribute visitors are reached with JSXOpeningElement parents. @preserve */
				if (!isJsxOpeningElement(openingElement)) return;

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
				if (isIdentifierName(node.id) && node.init !== null && isMemoCall(node.init)) {
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
