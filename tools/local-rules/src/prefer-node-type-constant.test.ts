import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import { createNodeTypeCatalog } from "./node-type-catalog";
import preferNodeTypeConstant, { createPreferNodeTypeConstantRule } from "./prefer-node-type-constant";

interface ProbeNode {
	readonly type: string;
}

const catalog = createNodeTypeCatalog(
	Object.entries({
		BLOCK_STATEMENT: "BlockStatement",
		CALL_EXPRESSION: "CallExpression",
		isBindingIdentifier: (node: ProbeNode): boolean => node.type === "Identifier",
		isCallExpression: (node?: null | ProbeNode): boolean => node?.type === "CallExpression",
		isIdentifierName: (node: ProbeNode): boolean => node.type === "Identifier",
	}),
);

/** Inline uses in other files of the bundle. */
const OTHER_FILE_USAGE = new Map([["ContinueStatement", 1]]);

const rule = createPreferNodeTypeConstantRule({
	catalog,
	countUsage: (nodeType, _filename, liveCounts) =>
		(liveCounts.get(nodeType) ?? 0) + (OTHER_FILE_USAGE.get(nodeType) ?? 0),
});

describe("prefer-node-type-constant", () => {
	ts.run("prefer-node-type-constant", rule, {
		invalid: [
			{
				code: 'if (node.callee.type === "CallExpression") {}',
				errors: [
					{
						data: { guards: "isCallExpression", replacement: "isCallExpression(node.callee)" },
						messageId: "useGuard",
					},
				],
			},
			{
				code: "if (node?.type !== CALL_EXPRESSION) {}",
				errors: [
					{
						data: { guards: "isCallExpression", replacement: "!isCallExpression(node)" },
						messageId: "useGuard",
					},
				],
			},
			{
				code: 'if ("Identifier" != node.type) {}',
				errors: [
					{
						data: {
							guards: "isIdentifierName, isBindingIdentifier",
							replacement: "!isIdentifierName(node)",
						},
						messageId: "useGuard",
					},
				],
			},
			{
				code: ["function isCallExpression(node) {", '\treturn node.type === "CallExpression";', "}"].join("\n"),
				errors: [
					{ data: { constant: "CALL_EXPRESSION", nodeType: "CallExpression" }, messageId: "useConstant" },
				],
			},
			{
				code: ["export default function (node) {", '\treturn node.type === "CallExpression";', "}"].join("\n"),
				errors: [
					{
						data: { guards: "isCallExpression", replacement: "isCallExpression(node)" },
						messageId: "useGuard",
					},
				],
			},
			{
				code: 'const check = (node) => node.type === "CallExpression";',
				errors: [
					{
						data: { guards: "isCallExpression", replacement: "isCallExpression(node)" },
						messageId: "useGuard",
					},
				],
			},
			{
				code: [
					"switch (body.type) {",
					'\tcase "BlockStatement":',
					"\t\tbreak;",
					"\tdefault:",
					"\t\tbreak;",
					"}",
				].join("\n"),
				errors: [
					{ data: { constant: "BLOCK_STATEMENT", nodeType: "BlockStatement" }, messageId: "useConstant" },
				],
			},
			{
				code: 'const isBlock = getNodeType(value) === "BlockStatement";',
				errors: [
					{ data: { constant: "BLOCK_STATEMENT", nodeType: "BlockStatement" }, messageId: "useConstant" },
				],
			},
			{
				code: 'const EXCLUDED_STATEMENTS = new Set(["BlockStatement", "ContinueStatement"]);',
				errors: [
					{ data: { constant: "BLOCK_STATEMENT", nodeType: "BlockStatement" }, messageId: "useConstant" },
					{
						data: { constant: "CONTINUE_STATEMENT", count: "2", nodeType: "ContinueStatement" },
						messageId: "addConstant",
					},
				],
			},
			{
				code: 'if (node.type === "TSInferType" || other.type === "TSInferType") {}',
				errors: [
					{
						data: { constant: "TS_INFER_TYPE", count: "2", nodeType: "TSInferType" },
						messageId: "addConstant",
					},
					{
						data: { constant: "TS_INFER_TYPE", count: "2", nodeType: "TSInferType" },
						messageId: "addConstant",
					},
				],
			},
		],
		valid: [
			'if (node.type === "TSInferType") {}',
			"if (node.type === BLOCK_STATEMENT) {}",
			"if (node.type === SOMETHING_ELSE) {}",
			'const REACT_NODE_TYPE_NAMES = new Set(["JSXElement", "ReactElement", "ReactNode"]);',
			'const EMPTY = [];\nconst HOLES = [, "BlockStatement"];\nconst SPREAD = [...TYPES, "BlockStatement"];',
			'if (name === "BlockStatement") {}',
			'switch (name) { case "BlockStatement": break; }',
			"switch (node.type) { default: break; }",
			'if (node.type > "BlockStatement") {}',
			'if (node["type"] === "CallExpression") {}',
			'if (node.kind === "BlockStatement") {}',
			'if (node.type === "Banana") {}',
			"if (node.type === `BlockStatement`) {}",
			'type Narrowed = Extract<ESTree.Node, { type: "Identifier" }>;',
			'const visitor = { "CallExpression:exit"() {} };',
		],
	});
});

describe("prefer-node-type-constant with @small-rules/oxlint-utilities", () => {
	ts.run("prefer-node-type-constant", preferNodeTypeConstant, {
		invalid: [
			{
				code: 'if (node.callee.type === "CallExpression") {}',
				errors: [
					{
						data: { guards: "isCallExpression", replacement: "isCallExpression(node.callee)" },
						messageId: "useGuard",
					},
				],
			},
		],
		valid: ["if (isCallExpression(node.callee)) {}"],
	});
});
