import { describe, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";

import { getRootIdentifier } from "$oxc-utilities/oxc-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

function getThisMemberFixture(): ESTree.MemberExpression {
	return fromPartial({
		computed: false,
		object: { type: "ThisExpression" },
		property: { name: "value", type: "Identifier" },
		type: "MemberExpression",
	});
}

function getWrappedMemberFixture(): ESTree.MemberExpression {
	return fromPartial({
		computed: false,
		object: {
			expression: { name: "store", type: "Identifier" },
			type: "TSNonNullExpression",
		},
		property: { name: "value", type: "Identifier" },
		type: "MemberExpression",
	});
}

describe("oxc utilities", () => {
	describe("getRootIdentifier", () => {
		it("should return the identifier at the root of a wrapped member chain", ({ expect }) => {
			expect.assertions(1);

			// Arrange
			const expression = getWrappedMemberFixture();

			// Act
			const result = getRootIdentifier(expression);

			// Assert
			expect(result?.name).toBe("store");
		});

		it("should return undefined when the member chain is not rooted at an identifier", ({ expect }) => {
			expect.assertions(1);

			// Arrange
			const expression = getThisMemberFixture();

			// Act
			const result = getRootIdentifier(expression);

			// Assert
			expect(result).toBeUndefined();
		});
	});
});
