import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import { createNodeTypeCatalog } from "./node-type-catalog";
import preferNodeTypeConstant, { createPreferNodeTypeConstantRule } from "./prefer-node-type-constant";
import { indexUtilities } from "./utilities-index";

interface ProbeNode {
	readonly type: string;
}

const catalog = createNodeTypeCatalog(
	Object.entries({
		BLOCK_STATEMENT: "BlockStatement",
		CALL_EXPRESSION: "CallExpression",
		IDENTIFIER: "Identifier",
		isBindingIdentifier: (node: ProbeNode): boolean => node.type === "Identifier",
		isBlockStatement: (node: ProbeNode): boolean => node.type === "BlockStatement",
		isCallExpression: (node?: null | ProbeNode): boolean => node?.type === "CallExpression",
		isIdentifierName: (node: ProbeNode): boolean => node.type === "Identifier",
		RETURN_STATEMENT: "ReturnStatement",
	}),
);

/** Inline uses in other files of the bundle. */
const OTHER_FILE_USAGE = new Map([["ContinueStatement", 1]]);

const utilities = indexUtilities([
	{
		source: [
			"export function isIdentifierNamed(node: ESTree.Node | null | undefined, name: string): boolean {",
			"\treturn node?.type === IDENTIFIER && node.name === name;",
			"}",
		].join("\n"),
		specifier: "@small-rules/example",
	},
]);

const rule = createPreferNodeTypeConstantRule({
	catalog,
	countUsage: (nodeType, _filename, liveCounts) =>
		(liveCounts.get(nodeType) ?? 0) + (OTHER_FILE_USAGE.get(nodeType) ?? 0),
	getUtilities: () => utilities,
});

function prependImport(name: string, ...lines: ReadonlyArray<string>): string {
	return [`import { ${name} } from "@small-rules/oxlint-utilities";`, ...lines].join("\n");
}

describe("prefer-node-type-constant", () => {
	ts.run("prefer-node-type-constant", rule, {
		invalid: [
			{
				code: "if (value.type === IDENTIFIER && value.name === identifierName && isUsed(value)) {}",
				output: null,
				errors: [
					{
						data: {
							guards: "isIdentifierName, isBindingIdentifier",
							replacement: "isIdentifierName(value)",
						},
						messageId: "useGuard",
						suggestions: [
							{
								data: { replacement: "isIdentifierName(value)" },
								messageId: "useGuardSuggestion",
								output: prependImport(
									"isIdentifierName",
									"if (isIdentifierName(value) && value.name === identifierName && isUsed(value)) {}",
								),
							},
							{
								data: { replacement: "isBindingIdentifier(value)" },
								messageId: "useGuardSuggestion",
								output: prependImport(
									"isBindingIdentifier",
									"if (isBindingIdentifier(value) && value.name === identifierName && isUsed(value)) {}",
								),
							},
						],
					},
				],
			},
			{
				code: 'if (node.callee.type === "CallExpression") {}',
				output: prependImport("isCallExpression", "if (isCallExpression(node.callee)) {}"),
				errors: [
					{
						data: { guards: "isCallExpression", replacement: "isCallExpression(node.callee)" },
						messageId: "useGuard",
					},
				],
			},
			{
				code: "if (node?.type !== CALL_EXPRESSION) {}",
				output: prependImport("isCallExpression", "if (!isCallExpression(node)) {}"),
				errors: [
					{
						data: { guards: "isCallExpression", replacement: "!isCallExpression(node)" },
						messageId: "useGuard",
					},
				],
			},
			{
				code: "if ((first, second).type === CALL_EXPRESSION) {}",
				output: prependImport("isCallExpression", "if (isCallExpression((first, second))) {}"),
				errors: [
					{
						data: { guards: "isCallExpression", replacement: "isCallExpression((first, second))" },
						messageId: "useGuard",
					},
				],
			},
			{
				code: [
					'import { isCallExpression } from "@small-rules/oxlint-utilities";',
					"if (node.type === CALL_EXPRESSION) {}",
				].join("\n"),
				output: prependImport("isCallExpression", "if (isCallExpression(node)) {}"),
				errors: [{ messageId: "useGuard" }],
			},
			{
				code: ["const isCallExpression = 1;", "if (node.type === CALL_EXPRESSION) {}"].join("\n"),
				output: null,
				errors: [{ messageId: "useGuard" }],
			},
			{
				code: "if (body?.type === BLOCK_STATEMENT) {}",
				output: null,
				errors: [
					{
						data: { guards: "isBlockStatement", replacement: "isBlockStatement(body)" },
						messageId: "useGuard",
						suggestions: 0,
					},
				],
			},
			{
				code: 'if ("Identifier" != node.type) {}',
				output: null,
				errors: [
					{
						data: {
							guards: "isIdentifierName, isBindingIdentifier",
							replacement: "!isIdentifierName(node)",
						},
						messageId: "useGuard",
						suggestions: [
							{
								data: { replacement: "!isIdentifierName(node)" },
								messageId: "useGuardSuggestion",
								output: prependImport("isIdentifierName", "if (!isIdentifierName(node)) {}"),
							},
							{
								data: { replacement: "!isBindingIdentifier(node)" },
								messageId: "useGuardSuggestion",
								output: prependImport("isBindingIdentifier", "if (!isBindingIdentifier(node)) {}"),
							},
						],
					},
				],
			},
			{
				code: "if (value?.type === IDENTIFIER) {}",
				output: null,
				errors: [{ messageId: "useGuard", suggestions: 0 }],
			},
			{
				code: ["function isCallExpression(node) {", '\treturn node.type === "CallExpression";', "}"].join("\n"),
				output: prependImport(
					"CALL_EXPRESSION",
					"function isCallExpression(node) {",
					"\treturn node.type === CALL_EXPRESSION;",
					"}",
				),
				errors: [
					{ data: { constant: "CALL_EXPRESSION", nodeType: "CallExpression" }, messageId: "useConstant" },
				],
			},
			{
				code: ["export default function (node) {", '\treturn node.type === "CallExpression";', "}"].join("\n"),
				output: prependImport(
					"isCallExpression",
					"export default function (node) {",
					"\treturn isCallExpression(node);",
					"}",
				),
				errors: [
					{
						data: { guards: "isCallExpression", replacement: "isCallExpression(node)" },
						messageId: "useGuard",
					},
				],
			},
			{
				code: 'const check = (node) => node.type === "CallExpression";',
				output: prependImport("isCallExpression", "const check = (node) => isCallExpression(node);"),
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
				output: prependImport(
					"BLOCK_STATEMENT",
					"switch (body.type) {",
					"\tcase BLOCK_STATEMENT:",
					"\t\tbreak;",
					"\tdefault:",
					"\t\tbreak;",
					"}",
				),
				errors: [
					{ data: { constant: "BLOCK_STATEMENT", nodeType: "BlockStatement" }, messageId: "useConstant" },
				],
			},
			{
				code: 'const isBlock = getNodeType(value) === "BlockStatement";',
				output: prependImport("BLOCK_STATEMENT", "const isBlock = getNodeType(value) === BLOCK_STATEMENT;"),
				errors: [
					{ data: { constant: "BLOCK_STATEMENT", nodeType: "BlockStatement" }, messageId: "useConstant" },
				],
			},
			{
				code: 'const EXCLUDED_STATEMENTS = new Set(["BlockStatement", "ContinueStatement"]);',
				output: prependImport(
					"BLOCK_STATEMENT",
					'const EXCLUDED_STATEMENTS = new Set([BLOCK_STATEMENT, "ContinueStatement"]);',
				),
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
				output: null,
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
			"if (value.type === IDENTIFIER && value.name === identifierName) {}",
			'if (node.type === "TSInferType") {}',
			"if (node.type === RETURN_STATEMENT) {}",
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
				output: prependImport("isCallExpression", "if (isCallExpression(node.callee)) {}"),
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
