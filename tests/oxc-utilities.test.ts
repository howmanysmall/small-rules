import { describe, expect, it } from "vitest";

import { isTsTypeAssertion } from "$oxc-utilities/oxc-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

describe("isTsTypeAssertion", () => {
	it("should recognize TypeScript type assertion nodes", () => {
		expect.assertions(1);

		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Utility tests build minimal AST nodes for parser-shape branches.
		const node = { type: "TSTypeAssertion" } as ESTree.Node;
		expect(isTsTypeAssertion(node)).toBe(true);
	});

	it("does not treat as-expressions as angle-bracket type assertions", () => {
		expect.assertions(1);

		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Utility tests build minimal AST nodes for parser-shape branches.
		const node = { type: "TSAsExpression" } as ESTree.Node;
		expect(isTsTypeAssertion(node)).toBe(false);
	});
});
