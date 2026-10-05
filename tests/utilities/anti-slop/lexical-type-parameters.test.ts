import { describe, expect, it } from "vitest";
import { isNode } from "@small-rules/oxlint-utilities";
import { traverseAst } from "@small-rules/rule-harness/ast";
import { parseCase } from "@small-rules/rule-harness/parse";

import { getLexicalTypeParameterNames } from "$oxc-utilities/anti-slop/lexical-type-parameters";

import type { HarnessNode, HarnessSourceCode } from "@small-rules/rule-harness/types";
import type { ESTree } from "oxlint-plugin-utilities";

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

function findConditionalType(source: HarnessSourceCode): ESTree.TSConditionalType {
	let found: ESTree.TSConditionalType | undefined;
	traverseAst(source.ast, {
		TSConditionalType(node: HarnessNode) {
			if (isNode(node) && node.type === "TSConditionalType") {
				found ??= node;
			}
		},
	});
	if (found === undefined) {
		const error = new Error('Node of type "TSConditionalType" not found.');
		Error.captureStackTrace(error, findConditionalType);
		throw error;
	}
	return found;
}

function findMappedTypeAnnotation(source: HarnessSourceCode): ESTree.TSType {
	let found: ESTree.TSType | undefined;
	traverseAst(source.ast, {
		TSMappedType(node: HarnessNode) {
			if (isNode(node) && node.type === "TSMappedType" && node.typeAnnotation !== null) {
				found ??= node.typeAnnotation;
			}
		},
	});
	if (found === undefined) {
		const error = new Error("TSMappedType annotation not found.");
		Error.captureStackTrace(error, findMappedTypeAnnotation);
		throw error;
	}
	return found;
}

describe("getLexicalTypeParameterNames", () => {
	it("stops descending when the node type has no visitor keys", () => {
		expect.assertions(1);

		const source = parseCode("type Handler<Value> = Value extends { readonly item: infer Item } ? Item : never;");
		const conditional = findConditionalType(source);
		const names = getLexicalTypeParameterNames(conditional.trueType, {});

		expect([...names]).toStrictEqual(["Value"]);
	});

	it("collects infer bindings through real visitor keys", () => {
		expect.assertions(1);

		const source = parseCode("type Handler<Value> = Value extends { readonly item: infer Item } ? Item : never;");
		const conditional = findConditionalType(source);
		const names = getLexicalTypeParameterNames(conditional.trueType, source.visitorKeys);

		expect([...names].toSorted()).toStrictEqual(["Item", "Value"]);
	});

	it("collects mapped type key names from nested descendants", () => {
		expect.assertions(1);

		const source = parseCode("type Mappers<Key extends string> = { [Target in Key]: () => void };");
		const annotation = findMappedTypeAnnotation(source);
		const names = getLexicalTypeParameterNames(annotation, source.visitorKeys);

		expect([...names].toSorted()).toStrictEqual(["Key", "Target"]);
	});
});
