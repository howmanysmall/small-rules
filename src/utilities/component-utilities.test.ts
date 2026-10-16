import { describe, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";

import { getJSXAttributeName, isSimpleExpression } from "$oxc-utilities/component-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

function getNamespacedAttributeFixture(): ESTree.JSXAttribute {
	return fromPartial({
		name: {
			name: { name: "key", type: "JSXIdentifier" },
			namespace: { name: "rbxts", type: "JSXIdentifier" },
			type: "JSXNamespacedName",
		},
		type: "JSXAttribute",
	});
}

function getParenthesizedExpressionFixture(): ESTree.ParenthesizedExpression {
	return fromPartial({
		expression: { name: "value", type: "Identifier" },
		type: "ParenthesizedExpression",
	});
}

describe("component utilities", () => {
	describe("getJSXAttributeName", () => {
		it("should return the local name for namespaced JSX attributes", ({ expect }) => {
			expect.assertions(1);

			// Arrange
			const attribute = getNamespacedAttributeFixture();

			// Act
			const result = getJSXAttributeName(attribute);

			// Assert
			expect(result).toBe("key");
		});
	});

	describe("isSimpleExpression", () => {
		it("should unwrap parenthesized expressions", ({ expect }) => {
			expect.assertions(1);

			// Arrange
			const expression = getParenthesizedExpressionFixture();

			// Act
			const result = isSimpleExpression(expression);

			// Assert
			expect(result).toBe(true);
		});
	});
});
