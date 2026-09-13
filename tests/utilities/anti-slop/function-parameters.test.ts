import { describe, expect, it } from "vitest";

import {
	containsUnknownType,
	getFunctionParameterBindingName,
	getFunctionParameterTypeAnnotation,
} from "$oxc-utilities/anti-slop/function-parameters";
import { isNode } from "$oxc-utilities/oxc-utilities";
import { traverseAst } from "$test/rule-harness/ast";
import { parseCase } from "$test/rule-harness/parse";

import type { ESTree } from "oxlint-plugin-utilities";

import type { HarnessNode, HarnessSourceCode } from "$test/rule-harness/types";

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

function firstFunction(source: HarnessSourceCode): ESTree.Function {
	let found: ESTree.Function | undefined;
	traverseAst(source.ast, {
		FunctionDeclaration(node: HarnessNode) {
			if (isNode(node) && node.type === "FunctionDeclaration") {
				found ??= node;
			}
		},
	});
	if (found === undefined) throw new Error("FunctionDeclaration not found.");
	return found;
}

function firstArrow(source: HarnessSourceCode): ESTree.ArrowFunctionExpression {
	let found: ESTree.ArrowFunctionExpression | undefined;
	traverseAst(source.ast, {
		ArrowFunctionExpression(node: HarnessNode) {
			if (isNode(node) && node.type === "ArrowFunctionExpression") {
				found ??= node;
			}
		},
	});
	if (found === undefined) throw new Error("ArrowFunctionExpression not found.");
	return found;
}

function firstTSFunctionType(source: HarnessSourceCode): ESTree.TSFunctionType {
	let found: ESTree.TSFunctionType | undefined;
	traverseAst(source.ast, {
		TSFunctionType(node: HarnessNode) {
			if (isNode(node) && node.type === "TSFunctionType") {
				found ??= node;
			}
		},
	});
	if (found === undefined) throw new Error("TSFunctionType not found.");
	return found;
}

function firstParameterProperty(source: HarnessSourceCode): ESTree.TSParameterProperty {
	let found: ESTree.TSParameterProperty | undefined;
	traverseAst(source.ast, {
		TSParameterProperty(node: HarnessNode) {
			if (isNode(node) && node.type === "TSParameterProperty") {
				found ??= node;
			}
		},
	});
	if (found === undefined) throw new Error("TSParameterProperty not found.");
	return found;
}

function firstTypeAnnotation(code: string): ESTree.TSType {
	const source = parseCode(code);
	let found: ESTree.TSTypeAnnotation | undefined;
	traverseAst(source.ast, {
		TSTypeAnnotation(node: HarnessNode) {
			if (isNode(node) && node.type === "TSTypeAnnotation") {
				found ??= node;
			}
		},
	});
	if (found === undefined) throw new Error("TSTypeAnnotation not found.");
	return found.typeAnnotation;
}

function requireParameter(
	owner: { readonly params: ReadonlyArray<ESTree.ParamPattern> },
	index: number,
): ESTree.ParamPattern {
	const parameter = owner.params[index];
	if (parameter === undefined) throw new Error(`Expected parameter at index ${index}.`);
	return parameter;
}

describe("getFunctionParameterTypeAnnotation", () => {
	it.each([
		["identifier", "function f(value: string): void {}", "TSStringKeyword"],
		["rest element", "function f(...values: string[]): void {}", "TSArrayType"],
		["assignment pattern", 'function f(value: string = "default"): void {}', "TSStringKeyword"],
		["destructured object", "function f({ value }: { value: string }): void {}", "TSTypeLiteral"],
	])("extracts the annotation from a %s parameter", (_name, code, expectedType) => {
		expect.assertions(1);

		const source = parseCode(code);
		const parameter = requireParameter(firstFunction(source), 0);

		expect(getFunctionParameterTypeAnnotation(parameter)?.typeAnnotation.type).toBe(expectedType);
	});

	it.each([
		["unannotated identifier", "function f(value): void {}"],
		["unannotated rest element", "function f(...values): void {}"],
		["unannotated assignment pattern", 'function f(value = "default"): void {}'],
	])("returns undefined for an %s", (_name, code) => {
		expect.assertions(1);

		const source = parseCode(code);
		const parameter = requireParameter(firstFunction(source), 0);

		expect(getFunctionParameterTypeAnnotation(parameter)).toBeUndefined();
	});

	it("extracts the annotation through a parameter property wrapper", () => {
		expect.assertions(1);

		const source = parseCode("class C { constructor(public value: string) {} }");
		const parameter = firstParameterProperty(source);

		expect(getFunctionParameterTypeAnnotation(parameter)?.typeAnnotation.type).toBe("TSStringKeyword");
	});

	it("extracts the annotation from an arrow function parameter", () => {
		expect.assertions(1);

		const source = parseCode("const f = (value: string) => {};");
		const parameter = requireParameter(firstArrow(source), 0);

		expect(getFunctionParameterTypeAnnotation(parameter)?.typeAnnotation.type).toBe("TSStringKeyword");
	});

	it("extracts the annotation from a function type parameter", () => {
		expect.assertions(1);

		const source = parseCode("type F = (value: string) => void;");
		const parameter = requireParameter(firstTSFunctionType(source), 0);

		expect(getFunctionParameterTypeAnnotation(parameter)?.typeAnnotation.type).toBe("TSStringKeyword");
	});
});

describe("getFunctionParameterBindingName", () => {
	it.each([
		["simple parameter", "function f(value: string): void {}", "value"],
		["default-value parameter", 'function f(value: string = "default"): void {}', "value"],
		["destructured parameter", "function f({ value }: { value: string }): void {}", "{ value }"],
		["unannotated destructured parameter", "function f({ value }): void {}", "{ value }"],
		["default-value destructured parameter", "function f({ value }: { value: string } = {}): void {}", "{ value }"],
		["rest parameter", "function f(...values: string[]): void {}", "values"],
	])("returns the binding name for a %s", (_name, code, expected) => {
		expect.assertions(1);

		const source = parseCode(code);
		const parameter = requireParameter(firstFunction(source), 0);

		expect(getFunctionParameterBindingName(parameter, source)).toBe(expected);
	});

	it("returns the parameter property binding name", () => {
		expect.assertions(1);

		const source = parseCode("class C { constructor(public value: string) {} }");
		const parameter = firstParameterProperty(source);

		expect(getFunctionParameterBindingName(parameter, source)).toBe("value");
	});
});

describe("containsUnknownType", () => {
	it.each([
		["bare unknown", "let _v: unknown;", "TSUnknownKeyword", true],
		["union with unknown", "let _v: string | unknown;", "TSUnionType", true],
		["parenthesized unknown", "let _v: (unknown);", "TSParenthesizedType", true],
		["nested union with unknown", "let _v: string | (number | unknown);", "TSUnionType", true],
		["string only", "let _v: string;", "TSStringKeyword", false],
		["union without unknown", "let _v: string | number;", "TSUnionType", false],
		["parenthesized non-unknown", "let _v: (string);", "TSParenthesizedType", false],
	])("detects unknown in %s", (_name, code, expectedRootType, expected) => {
		expect.assertions(2);

		const type = firstTypeAnnotation(code);

		expect(type.type).toBe(expectedRootType);
		expect(containsUnknownType(type)).toBe(expected);
	});
});
