import { describe, expect, it } from "vitest";
import { getJSXAttributeName, isSimpleExpression } from "$oxc-utilities/component-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

function namespacedAttributeFixture(): ESTree.JSXAttribute {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Utility tests build minimal AST nodes for parser-shape branches.
	return {
		name: {
			name: { name: "key", type: "JSXIdentifier" },
			namespace: { name: "rbxts", type: "JSXIdentifier" },
			type: "JSXNamespacedName",
		},
		type: "JSXAttribute",
	} as ESTree.JSXAttribute;
}

function parenthesizedExpressionFixture(): ESTree.ParenthesizedExpression {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Utility tests build minimal AST nodes for parser-shape branches.
	return {
		expression: { name: "value", type: "Identifier" },
		type: "ParenthesizedExpression",
	} as ESTree.ParenthesizedExpression;
}

describe("component utilities", () => {
	describe("getJSXAttributeName", () => {
		it("should return the local name for namespaced JSX attributes", () => {
			expect.assertions(1);

			// Arrange
			const attribute = namespacedAttributeFixture();

			// Act
			const result = getJSXAttributeName(attribute);

			// Assert
			expect(result).toBe("key");
		});
	});

	describe("isSimpleExpression", () => {
		it("should unwrap parenthesized expressions", () => {
			expect.assertions(1);

			// Arrange
			const expression = parenthesizedExpressionFixture();

			// Act
			const result = isSimpleExpression(expression);

			// Assert
			expect(result).toBe(true);
		});
	});
});
