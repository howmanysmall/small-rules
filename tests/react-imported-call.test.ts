// oxlint-disable typescript/no-unsafe-type-assertion -- Unit tests bridge the
// harness AST to the rule's ESTree SourceCode types for direct utility
// coverage.
import { describe, expect, it } from "vitest";
import { Predicate } from "effect";

import { isReactImportedCall } from "$oxc-utilities/react-utilities";

import { traverseAst } from "./rule-harness/ast";
import { parseCase } from "./rule-harness/parse";

import type { HarnessNode, HarnessSourceCode } from "./rule-harness/types";

const reactSources = new Set(["react"]);
const effectNames = new Set(["useEffect"]);

function findCall(source: HarnessSourceCode, name: string): HarnessNode {
	let found: HarnessNode | undefined;
	traverseAst(source.ast, {
		CallExpression(node: HarnessNode) {
			if (found !== undefined) return;
			if (calleeName(node.callee) === name) found = node;
		},
	});
	if (found === undefined) throw new Error(`Call expression "${name}" not found.`);
	return found;
}

function calleeName(callee: unknown): string | undefined {
	if (!Predicate.isObject(callee)) return undefined;
	const { type } = callee;
	if (type === "Identifier") {
		const { name } = callee;
		return Predicate.isString(name) ? name : undefined;
	}
	if (type !== "MemberExpression") return undefined;

	const { property } = callee;
	if (!Predicate.isObject(property)) return undefined;

	if (property.type === "Identifier") {
		const { name } = property;
		return Predicate.isString(name) ? name : undefined;
	}

	if (property.type === "Literal") {
		const { value } = property;
		return Predicate.isString(value) ? value : undefined;
	}

	return undefined;
}

function parseCode(code: string): HarnessSourceCode {
	return parseCase({
		code,
		filename: "case.tsx",
		kind: "valid",
		language: "tsx",
		options: [],
		settings: {},
		sourceType: "module",
	});
}

describe("isReactImportedCall", () => {
	it("matches a named import by its imported name", () => {
		expect.assertions(1);

		const source = parseCode('import { useEffect as effect } from "react"; effect(() => {});');
		expect(
			isReactImportedCall(source as never, findCall(source, "effect") as never, effectNames, reactSources),
		).toBe(true);
	});

	it("rejects an identifier with no binding", () => {
		expect.assertions(1);

		const source = parseCode("useEffect(() => {});");
		expect(
			isReactImportedCall(source as never, findCall(source, "useEffect") as never, effectNames, reactSources),
		).toBe(false);
	});

	it("rejects an import from a non-react source", () => {
		expect.assertions(1);

		const source = parseCode('import { useEffect } from "preact/hooks"; useEffect(() => {});');
		expect(
			isReactImportedCall(source as never, findCall(source, "useEffect") as never, effectNames, reactSources),
		).toBe(false);
	});

	it("rejects a default/namespace import used as a named callee", () => {
		expect.assertions(1);

		const source = parseCode('import * as React from "react"; React(() => {});');
		expect(
			isReactImportedCall(source as never, findCall(source, "React") as never, effectNames, reactSources),
		).toBe(false);
	});

	it("rejects a non-imported identifier binding", () => {
		expect.assertions(1);

		const source = parseCode("const useEffect = () => {}; useEffect(() => {});");
		expect(
			isReactImportedCall(source as never, findCall(source, "useEffect") as never, effectNames, reactSources),
		).toBe(false);
	});

	it("matches a namespace member call", () => {
		expect.assertions(1);

		const source = parseCode('import * as React from "react"; React.useEffect(() => {});');
		expect(
			isReactImportedCall(source as never, findCall(source, "useEffect") as never, effectNames, reactSources),
		).toBe(true);
	});

	it("rejects a computed member call", () => {
		expect.assertions(1);

		const source = parseCode('import * as React from "react"; React["useEffect"](() => {});');
		expect(
			isReactImportedCall(source as never, findCall(source, "useEffect") as never, effectNames, reactSources),
		).toBe(false);
	});

	it("rejects a non-identifier member object", () => {
		expect.assertions(1);

		const source = parseCode('import * as React from "react"; getReact().useEffect(() => {});');
		expect(
			isReactImportedCall(source as never, findCall(source, "useEffect") as never, effectNames, reactSources),
		).toBe(false);
	});
});
