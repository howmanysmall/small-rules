import { describe, expect, it } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule, { toConstantName } from "./prefer-node-type-constant";

describe("prefer-node-type-constant", () => {
	ts.run("prefer-node-type-constant", rule, {
		invalid: [
			{
				code: 'if (node.type === "Identifier") {}',
				errors: [{ data: { constant: "IDENTIFIER", nodeType: "Identifier" }, messageId: "preferConstant" }],
			},
			{
				code: 'const isReturn = statement?.type !== "ReturnStatement";',
				errors: [
					{
						data: { constant: "RETURN_STATEMENT", nodeType: "ReturnStatement" },
						messageId: "preferConstant",
					},
				],
			},
			{
				code: 'const isLogical = "LogicalExpression" == getNodeType(value);',
				errors: [
					{
						data: { constant: "LOGICAL_EXPRESSION", nodeType: "LogicalExpression" },
						messageId: "preferConstant",
					},
				],
			},
			{
				code: 'const isCast = node.type != "TSAsExpression";',
				errors: [
					{ data: { constant: "TS_AS_EXPRESSION", nodeType: "TSAsExpression" }, messageId: "preferConstant" },
				],
			},
			{
				code: [
					"switch (body.type) {",
					'\tcase "BlockStatement":',
					"\t\tbreak;",
					'\tcase "JSXElement":',
					"\t\tbreak;",
					"\tdefault:",
					"\t\tbreak;",
					"}",
				].join("\n"),
				errors: [
					{ data: { constant: "BLOCK_STATEMENT", nodeType: "BlockStatement" }, messageId: "preferConstant" },
					{ data: { constant: "JSX_ELEMENT", nodeType: "JSXElement" }, messageId: "preferConstant" },
				],
			},
			{
				code: 'const VALID_PARENT_TYPES = new Set<string>(["ConditionalExpression", "IfStatement"]);',
				errors: [
					{
						data: { constant: "CONDITIONAL_EXPRESSION", nodeType: "ConditionalExpression" },
						messageId: "preferConstant",
					},
					{ data: { constant: "IF_STATEMENT", nodeType: "IfStatement" }, messageId: "preferConstant" },
				],
			},
		],
		valid: [
			"if (node.type === IDENTIFIER) {}",
			'if (token.value === "map") {}',
			'if (node.name === "useBinding") {}',
			'if (node.operator !== "&&") {}',
			'switch (name) { case "print": break; }',
			'const NAMES = new Set(["print", "warn"]);',
			'const IDENTIFIER = "Identifier" as const satisfies NodeType;',
			'type Narrowed = Extract<ESTree.Node, { type: "Identifier" }>;',
			'const visitor = { "CallExpression:exit"() {} };',
			"const holes = [, 1];",
			"if (node.type === `Identifier`) {}",
		],
	});
});

describe("toConstantName", () => {
	it("converts node types to their constant names", () => {
		expect.assertions(5);

		expect(toConstantName("Identifier")).toBe("IDENTIFIER");
		expect(toConstantName("ArrowFunctionExpression")).toBe("ARROW_FUNCTION_EXPRESSION");
		expect(toConstantName("TSBigIntKeyword")).toBe("TS_BIG_INT_KEYWORD");
		expect(toConstantName("JSXEmptyExpression")).toBe("JSX_EMPTY_EXPRESSION");
		expect(toConstantName("TSTypeAnnotation")).toBe("TS_TYPE_ANNOTATION");
	});
});
