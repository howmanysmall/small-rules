import { describe, expect, it } from "vitest";

import { createNodeTypeCatalog } from "./node-type-catalog";

interface ProbeNode {
	readonly name?: unknown;
	readonly global?: unknown;
	readonly optional?: unknown;
	readonly type: string;
}

const UTILITIES = {
	BLOCK_STATEMENT: "BlockStatement",
	CALL_EXPRESSION: "CallExpression",
	COUNT: 3,
	getName: (node: ProbeNode): boolean => node.type === "Identifier",
	isAnyLiteral: (node: ProbeNode): boolean => node.type === "Literal",
	isBindingIdentifier: (node: ProbeNode): boolean => node.type === "Identifier",
	isCallExpression: (node?: null | ProbeNode): boolean => node?.type === "CallExpression",
	isFunctionLike: (node: ProbeNode): boolean =>
		node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression",
	isIdentifierName: (node: ProbeNode): boolean => node.type === "Identifier",
	isIdentifierNamed: (node: ProbeNode, name?: string): boolean => node.type === "Identifier" && node.name === name,
	isIdentifierNode: (node: ProbeNode): boolean => node.type === "Identifier",
	isJsxIdentifier: (node: ProbeNode): boolean => node.type === "JSXIdentifier" && "name" in node,
	isLiteral: (node: ProbeNode): boolean => node.type === "Literal",
	isNotEmptyStatement: (node: ProbeNode): boolean => node.type !== "EmptyStatement",
	isStaticCall: (node: ProbeNode): boolean => node.type === "CallExpression" && node.optional === undefined,
	isThrowing: (node: ProbeNode): boolean => {
		if (node.type === "Program") throw new Error("probe");
		return node.type === "ThisExpression";
	},
	isTsModuleDeclaration: (node: ProbeNode): boolean =>
		node.type === "TSModuleDeclaration" && node.global === undefined,
	NOT_A_NODE_TYPE: "Banana",
};

describe("createNodeTypeCatalog", () => {
	it("maps each node type to the exported constant holding it", () => {
		expect.assertions(4);

		const catalog = createNodeTypeCatalog(Object.entries(UTILITIES));

		expect(catalog.getConstant("CallExpression")).toBe("CALL_EXPRESSION");
		expect(catalog.getConstant("Banana")).toBeUndefined();
		expect(catalog.getNodeTypeOfConstant("BLOCK_STATEMENT")).toBe("BlockStatement");
		expect(catalog.getNodeTypeOfConstant("COUNT")).toBeUndefined();
	});

	it("keeps only guards whose answer depends on the node type alone and matches exactly one type", () => {
		expect.assertions(1);

		const catalog = createNodeTypeCatalog(Object.entries(UTILITIES));

		expect({
			CallExpression: catalog.getGuards("CallExpression"),
			Identifier: catalog.getGuards("Identifier"),
			JSXIdentifier: catalog.getGuards("JSXIdentifier"),
			Literal: catalog.getGuards("Literal"),
			ThisExpression: catalog.getGuards("ThisExpression"),
			TSModuleDeclaration: catalog.getGuards("TSModuleDeclaration"),
		}).toStrictEqual({
			CallExpression: ["isCallExpression"],
			Identifier: ["isIdentifierName", "isIdentifierNode", "isBindingIdentifier"],
			JSXIdentifier: [],
			Literal: ["isLiteral", "isAnyLiteral"],
			ThisExpression: [],
			TSModuleDeclaration: [],
		});
	});

	it("knows which functions are guards", () => {
		expect.assertions(3);

		const catalog = createNodeTypeCatalog(Object.entries(UTILITIES));

		expect(catalog.isGuardName("isCallExpression")).toBe(true);
		expect(catalog.isGuardName("isFunctionLike")).toBe(false);
		expect(catalog.isGuardName("getName")).toBe(false);
	});
});
