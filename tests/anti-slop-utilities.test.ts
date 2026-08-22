// oxlint-disable typescript/no-unsafe-type-assertion -- Unit tests bridge the
// harness AST to the utilities' ESTree types for direct coverage.
import { describe, expect, it } from "vitest";
import { createTypeEnvironment } from "$oxc-utilities/anti-slop/dictionary-types";
import { lexicalTypeParameterNames } from "$oxc-utilities/anti-slop/lexical-type-parameters";

import { traverseAst } from "./rule-harness/ast";
import { parseCase } from "./rule-harness/parse";

import type { HarnessNode, HarnessSourceCode } from "./rule-harness/types";

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

function findNodeOfType(source: HarnessSourceCode, nodeType: string): HarnessNode {
	let found: HarnessNode | undefined;
	traverseAst(source.ast, {
		[nodeType](node: HarnessNode) {
			found ??= node;
		},
	});
	if (found === undefined) {
		const error = new Error(`Node of type "${nodeType}" not found.`);
		Error.captureStackTrace(error, findNodeOfType);
		throw error;
	}
	return found;
}

describe("lexicalTypeParameterNames", () => {
	it("stops descending when the node type has no visitor keys", () => {
		expect.assertions(1);

		const source = parseCode("type Handler<Value> = Value extends { readonly item: infer Item } ? Item : never;");
		const conditional = findNodeOfType(source, "TSConditionalType");
		const trueType = conditional.trueType as HarnessNode;
		const names = lexicalTypeParameterNames(trueType as never, {});

		expect([...names]).toStrictEqual(["Value"]);
	});

	it("collects infer bindings through real visitor keys", () => {
		expect.assertions(1);

		const source = parseCode("type Handler<Value> = Value extends { readonly item: infer Item } ? Item : never;");
		const conditional = findNodeOfType(source, "TSConditionalType");
		const trueType = conditional.trueType as HarnessNode;
		const names = lexicalTypeParameterNames(trueType as never, source.visitorKeys);

		expect([...names].toSorted()).toStrictEqual(["Item", "Value"]);
	});

	it("collects mapped type key names from nested descendants", () => {
		expect.assertions(1);

		const source = parseCode("type Mappers<Key extends string> = { [Target in Key]: () => void };");
		const mapped = findNodeOfType(source, "TSMappedType");
		const annotation = mapped.typeAnnotation as HarnessNode;
		const names = lexicalTypeParameterNames(annotation as never, source.visitorKeys);

		expect([...names].toSorted()).toStrictEqual(["Key", "Target"]);
	});
});

describe("createTypeEnvironment", () => {
	it("collects aliases, interfaces, and shadowed built-ins from module declarations", () => {
		expect.assertions(5);

		const source = parseCode(
			[
				'import { Record } from "./owner";',
				"export default class Owner {}",
				"export {};",
				"export type Payload = unknown;",
				"interface Box { readonly id: string }",
				"interface Box { readonly width: number }",
			].join("\n"),
		);
		const environment = createTypeEnvironment(source.ast as never);

		expect(environment.aliases.has("Payload")).toBe(true);
		expect(environment.interfaces.get("Box")).toHaveLength(2);
		expect(environment.shadowedBuiltIns.has("Record")).toBe(true);
		expect(environment.shadowedBuiltIns.has("Partial")).toBe(false);
		expect(environment.shadowedBuiltIns.has("Payload")).toBe(false);
	});
});
