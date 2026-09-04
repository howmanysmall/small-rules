import { describe, expect, it } from "vitest";

import {
	isAccessorProperty,
	isClassDeclaration,
	isClassExpression,
	isFunctionLike,
	isNode,
	isStaticBlock,
	isTsDeclareFunction,
	isTsEmptyBodyFunctionExpression,
	isTsGlobalDeclaration,
	isTsImportEqualsDeclaration,
	isTsModuleBlock,
	isTsModuleDeclaration,
	isTsTypeParameter,
} from "$oxc-utilities/oxc-utilities";
import { traverseAst } from "$test/rule-harness/ast";
import { parseCase } from "$test/rule-harness/parse";

import type { ESTree } from "oxlint-plugin-utilities";

import type { HarnessNode, HarnessSourceCode } from "$test/rule-harness/types";

type NodeGuard = (node: ESTree.Node) => boolean;

const DISCRIMINANT_GUARDS = {
	isAccessorProperty,
	isClassDeclaration,
	isClassExpression,
	isFunctionLike,
	isStaticBlock,
	isTsDeclareFunction,
	isTsEmptyBodyFunctionExpression,
	isTsGlobalDeclaration,
	isTsImportEqualsDeclaration,
	isTsModuleBlock,
	isTsModuleDeclaration,
	isTsTypeParameter,
} satisfies {
	isAccessorProperty: (node: ESTree.Node) => node is ESTree.AccessorProperty & { type: "AccessorProperty" };
	isClassDeclaration: (node: ESTree.Node) => node is ESTree.Class & { type: "ClassDeclaration" };
	isClassExpression: (node: ESTree.Node) => node is ESTree.Class & { type: "ClassExpression" };
	isFunctionLike: (node: ESTree.Node) => node is ESTree.ArrowFunctionExpression | ESTree.Function;
	isStaticBlock: (node: ESTree.Node) => node is ESTree.StaticBlock;
	isTsDeclareFunction: (node: ESTree.Node) => node is ESTree.Function & { type: "TSDeclareFunction" };
	isTsEmptyBodyFunctionExpression: (
		node: ESTree.Node,
	) => node is ESTree.Function & { type: "TSEmptyBodyFunctionExpression" };
	isTsGlobalDeclaration: (
		node: ESTree.Node,
	) => node is ESTree.TSGlobalDeclaration & { global: true; type: "TSModuleDeclaration" };
	isTsImportEqualsDeclaration: (node: ESTree.Node) => node is ESTree.TSImportEqualsDeclaration;
	isTsModuleBlock: (node: ESTree.Node) => node is ESTree.TSModuleBlock;
	isTsModuleDeclaration: (
		node: ESTree.Node,
	) => node is ESTree.TSModuleDeclaration & { global: false; type: "TSModuleDeclaration" };
	isTsTypeParameter: (node: ESTree.Node) => node is ESTree.TSTypeParameter;
};

interface GuardCase {
	name: string;
	acceptedTypes: ReadonlyArray<ESTree.Node["type"]>;
	code: string;
	guard: NodeGuard;
	rejectedType: ESTree.Node["type"];
}

const GUARD_CASES: ReadonlyArray<GuardCase> = [
	{
		name: "accessor properties",
		acceptedTypes: ["AccessorProperty"],
		code: "class Example { accessor value = 1; plain = 2; }",
		guard: DISCRIMINANT_GUARDS.isAccessorProperty,
		rejectedType: "PropertyDefinition",
	},
	{
		name: "class declarations",
		acceptedTypes: ["ClassDeclaration"],
		code: "class Declaration {} const Expression = class {};",
		guard: DISCRIMINANT_GUARDS.isClassDeclaration,
		rejectedType: "ClassExpression",
	},
	{
		name: "class expressions",
		acceptedTypes: ["ClassExpression"],
		code: "class Declaration {} const Expression = class {};",
		guard: DISCRIMINANT_GUARDS.isClassExpression,
		rejectedType: "ClassDeclaration",
	},
	{
		name: "function-like nodes",
		acceptedTypes: [
			"ArrowFunctionExpression",
			"FunctionDeclaration",
			"FunctionExpression",
			"TSDeclareFunction",
			"TSEmptyBodyFunctionExpression",
		],
		code: [
			"declare function declared(): void;",
			"class Example { method(): void; method(): void {} }",
			"const arrow = () => {};",
			"function declaration() {}",
			"const expression = function () {};",
			"type Value = string;",
		].join("\n"),
		guard: DISCRIMINANT_GUARDS.isFunctionLike,
		rejectedType: "TSTypeAliasDeclaration",
	},
	{
		name: "import-equals declarations",
		acceptedTypes: ["TSImportEqualsDeclaration"],
		code: 'import Value = require("value"); import Other from "other";',
		guard: DISCRIMINANT_GUARDS.isTsImportEqualsDeclaration,
		rejectedType: "ImportDeclaration",
	},
	{
		name: "static blocks",
		acceptedTypes: ["StaticBlock"],
		code: "class Example { static {} method() {} }",
		guard: DISCRIMINANT_GUARDS.isStaticBlock,
		rejectedType: "BlockStatement",
	},
	{
		name: "declare functions",
		acceptedTypes: ["TSDeclareFunction"],
		code: "declare function declared(): void; const arrow = () => {};",
		guard: DISCRIMINANT_GUARDS.isTsDeclareFunction,
		rejectedType: "ArrowFunctionExpression",
	},
	{
		name: "empty-body function expressions",
		acceptedTypes: ["TSEmptyBodyFunctionExpression"],
		code: "class Example { method(): void; method(): void {} }",
		guard: DISCRIMINANT_GUARDS.isTsEmptyBodyFunctionExpression,
		rejectedType: "FunctionExpression",
	},
	{
		name: "module blocks",
		acceptedTypes: ["TSModuleBlock"],
		code: "namespace Values { export type Item = string; }",
		guard: DISCRIMINANT_GUARDS.isTsModuleBlock,
		rejectedType: "TSModuleDeclaration",
	},
	{
		name: "type parameters",
		acceptedTypes: ["TSTypeParameter"],
		code: "type Box<Value> = Value;",
		guard: DISCRIMINANT_GUARDS.isTsTypeParameter,
		rejectedType: "TSTypeParameterDeclaration",
	},
];

function parseCode(code: string): HarnessSourceCode {
	return parseCase({
		code,
		filename: "case.ts",
		kind: "valid",
		language: "ts",
		options: [],
		settings: {},
		sourceType: "module",
	});
}

function findNode(source: HarnessSourceCode, type: ESTree.Node["type"]): ESTree.Node {
	let found: ESTree.Node | undefined;
	traverseAst(source.ast, {
		"*"(node: HarnessNode) {
			if (isNode(node) && node.type === type) found ??= node;
		},
	});
	if (found === undefined) {
		const error = new Error(`Node of type "${type}" not found.`);
		Error.captureStackTrace(error, findNode);
		throw error;
	}
	return found;
}

function findNodes(source: HarnessSourceCode, type: ESTree.Node["type"]): ReadonlyArray<ESTree.Node> {
	const found = new Array<ESTree.Node>();
	traverseAst(source.ast, {
		"*"(node: HarnessNode) {
			if (isNode(node) && node.type === type) found.push(node);
		},
	});
	return found;
}

describe("ast node guards", () => {
	it.each(GUARD_CASES)("recognizes only $name", ({ acceptedTypes, code, guard, rejectedType }) => {
		expect.assertions(2);

		const source = parseCode(code);
		expect(acceptedTypes.every((type) => guard(findNode(source, type)))).toBe(true);
		expect(guard(findNode(source, rejectedType))).toBe(false);
	});

	it("distinguishes namespace declarations from global declarations", () => {
		expect.assertions(2);

		const source = parseCode("namespace Values {} export {}; declare global {}");
		const declarations = findNodes(source, "TSModuleDeclaration");

		expect(declarations.map(DISCRIMINANT_GUARDS.isTsModuleDeclaration)).toStrictEqual([true, false]);
		expect(declarations.map(DISCRIMINANT_GUARDS.isTsGlobalDeclaration)).toStrictEqual([false, true]);
	});
});
