import { describe, expect, it } from "vitest";

import {
	classifyUnsafeDictionary,
	classifyUnsafeDictionaryValue,
	classifyWideningTarget,
	createTypeEnvironment,
} from "$oxc-utilities/anti-slop/dictionary-types";
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

function getProgram(source: HarnessSourceCode): ESTree.Program {
	if (isNode(source.ast) && source.ast.type === "Program") return source.ast;
	const error = new Error("Source AST is not a program node.");
	Error.captureStackTrace(error, getProgram);
	throw error;
}

function collectTypes(source: HarnessSourceCode): Array<ESTree.TSType> {
	const collected = new Array<ESTree.TSType>();
	traverseAst(source.ast, {
		TSIntersectionType(node: HarnessNode) {
			if (isNode(node) && node.type === "TSIntersectionType") collected.push(node);
		},
		TSMappedType(node: HarnessNode) {
			if (isNode(node) && node.type === "TSMappedType") collected.push(node);
		},
		TSTypeLiteral(node: HarnessNode) {
			if (isNode(node) && node.type === "TSTypeLiteral") collected.push(node);
		},
		TSTypeReference(node: HarnessNode) {
			if (isNode(node) && node.type === "TSTypeReference") collected.push(node);
		},
		TSUnknownKeyword(node: HarnessNode) {
			if (isNode(node) && node.type === "TSUnknownKeyword") collected.push(node);
		},
	});
	return collected;
}

function firstOfType(types: ReadonlyArray<ESTree.TSType>, nodeType: string): ESTree.TSType | undefined {
	for (const candidate of types) {
		if (candidate.type === nodeType) return candidate;
	}
	return undefined;
}

interface TypeFixture {
	readonly environment: ReturnType<typeof createTypeEnvironment>;
	readonly source: HarnessSourceCode;
}

function setup(code: string): TypeFixture {
	const source = parseCode(code);
	return { environment: createTypeEnvironment(getProgram(source)), source };
}

describe("createTypeEnvironment", () => {
	it("collects aliases, interfaces, and shadowed built-ins from module declarations", () => {
		expect.assertions(5);

		const fixture = setup(
			[
				'import { Record } from "./owner";',
				"export default class Owner {}",
				"export {};",
				"export type Payload = unknown;",
				"interface Box { readonly id: string }",
				"interface Box { readonly width: number }",
			].join("\n"),
		);

		expect(fixture.environment.aliases.has("Payload")).toBe(true);
		expect(fixture.environment.interfaces.get("Box")).toHaveLength(2);
		expect(fixture.environment.shadowedBuiltIns.has("Record")).toBe(true);
		expect(fixture.environment.shadowedBuiltIns.has("Partial")).toBe(false);
		expect(fixture.environment.shadowedBuiltIns.has("Payload")).toBe(false);
	});

	it("marks built-in names redeclared by classes, enums, functions, interfaces, and duplicate aliases", () => {
		expect.assertions(8);

		const classEnvironment = createTypeEnvironment(getProgram(parseCode("class Partial {}")));
		const enumEnvironment = createTypeEnvironment(getProgram(parseCode("enum Record {}")));
		const localEnumEnvironment = createTypeEnvironment(getProgram(parseCode("enum Local {}")));
		const functionEnvironment = createTypeEnvironment(getProgram(parseCode("function Omit() {}")));
		const interfaceEnvironment = createTypeEnvironment(getProgram(parseCode("interface Required {}")));
		const duplicateAliasEnvironment = createTypeEnvironment(
			getProgram(parseCode("type Readonly<T> = T; type Readonly<T> = T;")),
		);
		const anonymousDefaultEnvironment = createTypeEnvironment(
			getProgram(parseCode(["export default class {}", "export {};"].join("\n"))),
		);

		expect(classEnvironment.shadowedBuiltIns.has("Partial")).toBe(true);
		expect(enumEnvironment.shadowedBuiltIns.has("Record")).toBe(true);
		expect(localEnumEnvironment.shadowedBuiltIns.has("Record")).toBe(false);
		expect(functionEnvironment.shadowedBuiltIns.has("Omit")).toBe(true);
		expect(interfaceEnvironment.shadowedBuiltIns.has("Required")).toBe(true);
		expect(duplicateAliasEnvironment.shadowedBuiltIns.has("Readonly")).toBe(true);
		expect(anonymousDefaultEnvironment.interfaces.size).toBe(0);
		expect(anonymousDefaultEnvironment.aliases.size).toBe(0);
	});
});

describe("classifyUnsafeDictionary", () => {
	it.each([
		["record values", "type A = Record<string, unknown>;", "unknown"],
		["any index values", "type A = { [key: string]: any };", "any"],
		["object mapped values", "type A = { [K in PropertyKey]: object };", "object"],
		["empty literal values", "type A = Record<string, {}>;", "empty-object"],
		["effectively empty literal brands", "type A = Record<string, { readonly __brand?: never }>;", "empty-object"],
		[
			"effectively empty interfaces",
			"interface Escape { readonly __brand?: never } type A = Record<string, Escape>;",
			"empty-object",
		],
		["unions containing unsafe members", "type A = Record<string, string | unknown>;", "union"],
		["unions containing empty aliases", "interface Empty {} type A = Record<string, string | Empty>;", "union"],
		["generic substitution", "type Index<T> = Record<string, T>; type A = Index<unknown>;", "unknown"],
		["defaulted generic parameters", "type Index<T = unknown> = Record<string, T>; type A = Index;", "unknown"],
	])("reports $1 as $2", (_name, code, unsafeValue) => {
		expect.assertions(2);

		const fixture = setup(code);
		let classified: ReturnType<typeof classifyUnsafeDictionary> | undefined;
		traverseAst(fixture.source.ast, {
			TSMappedType(node: HarnessNode) {
				if (isNode(node) && node.type === "TSMappedType" && classified === undefined) {
					classified = classifyUnsafeDictionary(node, fixture.environment);
				}
			},
			TSTypeLiteral(node: HarnessNode) {
				if (isNode(node) && node.type === "TSTypeLiteral" && classified === undefined) {
					classified = classifyUnsafeDictionary(node, fixture.environment);
				}
			},
			TSTypeReference(node: HarnessNode) {
				if (isNode(node) && node.type === "TSTypeReference" && classified === undefined) {
					classified = classifyUnsafeDictionary(node, fixture.environment);
				}
			},
		});

		expect(classified?.kind).toBe("unsafe-dictionary");
		expect(classified?.unsafeValue).toBe(unsafeValue);
	});

	it("keeps concrete, intersected-with-evidence, and shadowed dictionaries safe", () => {
		expect.assertions(6);

		const cases = [
			"type Commands = Record<string, Command>;",
			"interface Owner { readonly id: string } type A = Record<string, unknown & Owner>;",
			"import { Record } from './local'; type A = Record<string, unknown>;",
			"type NonNullable<T> = { value: T }; type A = Record<string, NonNullable<unknown>>;",
			"interface Owner { readonly id: string } interface Child extends Owner {} type A = Record<string, Child>;",
			"type Safe = Index<Command>; type Index<T> = Record<string, T>;",
		];
		for (const code of cases) {
			const fixture = setup(code);
			let reported = false;
			traverseAst(fixture.source.ast, {
				TSTypeLiteral(node: HarnessNode) {
					if (!isNode(node) || node.type !== "TSTypeLiteral") return;
					if (classifyUnsafeDictionary(node, fixture.environment) !== undefined) reported = true;
				},
				TSTypeReference(node: HarnessNode) {
					if (!isNode(node) || node.type !== "TSTypeReference") return;
					if (classifyUnsafeDictionary(node, fixture.environment) !== undefined) reported = true;
				},
			});
			expect(reported, code).toBe(false);
		}
	});

	it("propagates unsafe values through Pick and Omit of an unsafe dictionary", () => {
		expect.assertions(2);

		for (const wrapper of ["Pick", "Omit"]) {
			const fixture = setup(`type Source = Record<string, unknown>; type A = ${wrapper}<Source, never>;`);
			const references = new Array<ESTree.TSTypeReference>();
			traverseAst(fixture.source.ast, {
				TSTypeReference(node: HarnessNode) {
					if (isNode(node) && node.type === "TSTypeReference") references.push(node);
				},
			});
			const pickReference = references[1];
			expect(
				pickReference === undefined ? undefined : classifyUnsafeDictionary(pickReference, fixture.environment),
			).toBeDefined();
		}
	});

	it("terminates on recursive alias cycles", () => {
		expect.assertions(1);

		const fixture = setup("type Cycle = Cycle | unknown; type A = Record<string, Cycle>;");
		const literal = firstOfType(collectTypes(fixture.source), "TSTypeLiteral");

		expect(() =>
			literal === undefined ? undefined : classifyUnsafeDictionary(literal, fixture.environment),
		).not.toThrow();
	});
});

describe("classifyUnsafeDictionaryValue", () => {
	it("classifies direct value types including intersections and wrappers", () => {
		expect.assertions(6);

		const plainUnknown = setup("type A = Record<string, unknown>;");
		const recordValue = firstOfType(collectTypes(plainUnknown.source), "TSUnknownKeyword");
		expect(
			recordValue === undefined
				? undefined
				: classifyUnsafeDictionaryValue(recordValue, plainUnknown.environment)?.unsafeValue,
		).toBe("unknown");

		const wrapped = setup("type A = { [key: string]: Required<unknown> };");
		const wrappedValue = firstOfType(collectTypes(wrapped.source), "TSUnknownKeyword");
		expect(
			wrappedValue === undefined
				? undefined
				: classifyUnsafeDictionaryValue(wrappedValue, wrapped.environment)?.unsafeValue,
		).toBe("unknown");

		const ownerIntersection = setup(
			"interface Owner { readonly id: string } type A = Record<string, unknown & Owner>;",
		);
		const intersection = firstOfType(collectTypes(ownerIntersection.source), "TSIntersectionType");
		expect(
			intersection === undefined
				? undefined
				: classifyUnsafeDictionaryValue(intersection, ownerIntersection.environment),
		).toBeUndefined();

		const anyIntersection = setup("interface Owner { readonly id: string } type A = Record<string, any & Owner>;");
		const anyIntersectionType = firstOfType(collectTypes(anyIntersection.source), "TSIntersectionType");
		expect(
			anyIntersectionType === undefined
				? undefined
				: classifyUnsafeDictionaryValue(anyIntersectionType, anyIntersection.environment)?.unsafeValue,
		).toBe("any");

		const optionalNeverInterface = setup(
			"interface Brand { readonly __brand?: never } type A = Record<string, Brand>;",
		);
		let brandReference: ESTree.TSTypeReference | undefined;
		traverseAst(optionalNeverInterface.source.ast, {
			TSTypeReference(node: HarnessNode) {
				if (
					isNode(node) &&
					node.type === "TSTypeReference" &&
					node.typeName.type === "Identifier" &&
					node.typeName.name === "Brand"
				) {
					brandReference ??= node;
				}
			},
		});
		expect(
			brandReference === undefined
				? undefined
				: classifyUnsafeDictionaryValue(brandReference, optionalNeverInterface.environment)?.unsafeValue,
		).toBe("empty-object");

		const mergedInterfaces = setup(
			"interface Escape {} interface Escape { readonly id: string } type A = Record<string, Escape>;",
		);
		let escapeReference: ESTree.TSTypeReference | undefined;
		traverseAst(mergedInterfaces.source.ast, {
			TSTypeReference(node: HarnessNode) {
				if (
					isNode(node) &&
					node.type === "TSTypeReference" &&
					node.typeName.type === "Identifier" &&
					node.typeName.name === "Escape"
				) {
					escapeReference ??= node;
				}
			},
		});
		expect(
			escapeReference === undefined
				? undefined
				: classifyUnsafeDictionaryValue(escapeReference, mergedInterfaces.environment),
		).toBeUndefined();
	});

	it("leaves qualified references and generic aliases without arguments unclassified", () => {
		expect.assertions(2);

		const qualified = setup("declare namespace NS { export type Value = unknown } const value: NS.Value = input;");
		expect(
			classifyUnsafeDictionaryValue(getFirstAnnotationTarget(qualified.source), qualified.environment),
		).toBeUndefined();

		const unapplied = setup("type Value<T> = T; const value: Value = input;");
		expect(
			classifyUnsafeDictionaryValue(getFirstAnnotationTarget(unapplied.source), unapplied.environment),
		).toBeUndefined();
	});
});

function getFirstAnnotationTarget(source: HarnessSourceCode): ESTree.TSType {
	let found: ESTree.TSType | undefined;
	traverseAst(source.ast, {
		TSTypeAnnotation(node: HarnessNode) {
			if (isNode(node) && node.type === "TSTypeAnnotation") found ??= node.typeAnnotation;
		},
	});
	if (found === undefined) {
		const error = new Error("Type annotation not found.");
		Error.captureStackTrace(error, getFirstAnnotationTarget);
		throw error;
	}
	return found;
}

describe("classifyWideningTarget", () => {
	it.each([
		["unknown annotations", "const value: unknown = {};", "unknown"],
		["object annotations", "const value: object = {};", "object"],
		["populated anonymous literals", 'const value: { readonly id: string } = { id: "one" };', "anonymous object"],
		["index-signature literals", "const value: { [key: string]: number } = {};", "open dictionary"],
		["mapped types", "const value: { [K in string]: number } = {};", "open dictionary"],
		["transparent record wrappers", "const value: Readonly<Record<string, number>> = {};", "open dictionary"],
	])("classifies $1 as $2", (_name, code, kind) => {
		expect.assertions(1);

		const fixture = setup(code);
		expect(classifyWideningTarget(getFirstAnnotationTarget(fixture.source), fixture.environment)).toStrictEqual({
			kind,
		});
	});

	it("leaves empty literals, named contracts, and non-dictionary generics unclassified", () => {
		expect.assertions(5);

		const emptyLiteral = setup("const value: {} = {};");
		expect(
			classifyWideningTarget(getFirstAnnotationTarget(emptyLiteral.source), emptyLiteral.environment),
		).toBeUndefined();

		const namedObjectAlias = setup("type Commands = { readonly start: Command }; const commands: Commands = {};");
		expect(
			classifyWideningTarget(getFirstAnnotationTarget(namedObjectAlias.source), namedObjectAlias.environment),
		).toBeUndefined();

		const finiteMappedAlias = setup(
			"type Levels = { readonly [Level in Permission]: number }; const levels: Levels = {};",
		);
		expect(
			classifyWideningTarget(getFirstAnnotationTarget(finiteMappedAlias.source), finiteMappedAlias.environment),
		).toBeUndefined();

		const nonDictionaryGeneric = setup("type Box<Value> = Value; const value: Box<string> = {};");
		expect(
			classifyWideningTarget(
				getFirstAnnotationTarget(nonDictionaryGeneric.source),
				nonDictionaryGeneric.environment,
			),
		).toBeUndefined();

		const shadowedRecord = setup(
			"type Record<K, V> = { key: K; value: V }; const value: Record<string, unknown> = {};",
		);
		expect(
			classifyWideningTarget(getFirstAnnotationTarget(shadowedRecord.source), shadowedRecord.environment),
		).toBeUndefined();
	});

	it("classifies mapped aliases through broad key shapes and substitutions", () => {
		expect.assertions(5);

		const symbolKey = setup("type Levels = { readonly [Level in symbol]: number }; const levels: Levels = {};");
		expect(classifyWideningTarget(getFirstAnnotationTarget(symbolKey.source), symbolKey.environment)).toStrictEqual(
			{
				kind: "open dictionary",
			},
		);

		const unionKey = setup("type Ranges = { [K in string | number]: number }; const ranges: Ranges = {};");
		expect(classifyWideningTarget(getFirstAnnotationTarget(unionKey.source), unionKey.environment)).toStrictEqual({
			kind: "open dictionary",
		});

		const substitutedKey = setup(
			"type Inner<K = string> = { [X in K]: number }; type Names = Inner; const names: Names = {};",
		);
		expect(
			classifyWideningTarget(getFirstAnnotationTarget(substitutedKey.source), substitutedKey.environment),
		).toStrictEqual({
			kind: "open dictionary",
		});

		const unsubstitutedKey = setup(
			"type Key<T> = T; type Names2 = { [K in Key<string>]: number }; const names2: Names2 = {};",
		);
		expect(
			classifyWideningTarget(getFirstAnnotationTarget(unsubstitutedKey.source), unsubstitutedKey.environment),
		).toBeUndefined();

		const selfReferential = setup("type Id<T> = Id<T>; const value: Id<string> = {};");
		expect(
			classifyWideningTarget(getFirstAnnotationTarget(selfReferential.source), selfReferential.environment),
		).toBeUndefined();
	});

	it("classifies generic aliases only when their body resolves to a dictionary", () => {
		expect.assertions(1);

		const genericDictionary = setup("type Index<T> = Record<string, T>; const commands: Index<Command> = {};");
		expect(
			classifyWideningTarget(getFirstAnnotationTarget(genericDictionary.source), genericDictionary.environment),
		).toStrictEqual({ kind: "generic container" });
	});

	it.each([
		["const value: readonly string[] = [];", undefined],
		["declare namespace NS { export type Value = string } const value: NS.Value = input;", undefined],
		['type A = "literal"; const value: A = "literal";', undefined],
		["declare namespace NS { export type Value = string } type A = NS.Value; const value: A = input;", undefined],
		["type Broad = unknown; const value: Broad = input;", "unknown"],
		["type Broad = object; const value: Broad = input;", "object"],
		["const value: Open = {}; type Open = { [key: string]: string };", "open dictionary"],
		["type Wrapper = Readonly; const value: Wrapper = input;", undefined],
		["const value: Alias = {}; type Index<T> = Record<string, T>; type Alias = Index;", undefined],
		["const value: Narrow = {}; type Narrow = { [K in 'only']: string };", undefined],
		[
			"const value: Narrow = {}; declare namespace NS { export type Key = string } type Narrow = { [K in NS.Key]: string };",
			undefined,
		],
		["const value: Index = {}; type Index<T> = Record<string, T>;", undefined],
	])("handles transparent, qualified, and alias-backed widening target %s", (code, expected) => {
		const fixture = setup(code);
		expect(classifyWideningTarget(getFirstAnnotationTarget(fixture.source), fixture.environment)?.kind).toBe(
			expected,
		);
	});

	it("does not classify dictionaries when a generic alias lacks its required argument", () => {
		expect.assertions(1);

		const fixture = setup("type Index<T> = Record<string, T>; const value: Index = {};");
		expect(classifyUnsafeDictionary(getFirstAnnotationTarget(fixture.source), fixture.environment)).toBeUndefined();
	});

	it.each([
		[
			"number mapped keys",
			"type Counts = { [K in number]: Command }; const counts: Counts = {};",
			"open dictionary",
		],
		[
			"PropertyKey mapped keys",
			"type Wide = { [K in PropertyKey]: Command }; const wide: Wide = {};",
			"open dictionary",
		],
		[
			"mixed broad and narrow keys",
			"type Mixed = { [K in string | Permission]: Command }; const mixed: Mixed = {};",
			undefined,
		],
		[
			"shadowed PropertyKey mapped keys",
			"type PropertyKey = Permission; type Local = { [K in PropertyKey]: Command }; const local: Local = {};",
			undefined,
		],
		["bare wrapper annotations", "const value: Readonly = {};", undefined],
		[
			"aliases with missing type arguments",
			"type Index<T> = Record<string, T>; const value: Index = {};",
			undefined,
		],
		[
			"self-defaulting generic dictionaries",
			"type Loop<T = T> = Record<string, T>; const value: Loop<string> = {};",
			"generic container",
		],
		["recursive alias targets", "type Cycle2 = Cycle2; const value: Cycle2 = {};", undefined],
	])("widening: $1", (_name, code, expected) => {
		expect.assertions(1);

		const fixture = setup(code);
		const target = classifyWideningTarget(getFirstAnnotationTarget(fixture.source), fixture.environment);
		expect(target?.kind).toStrictEqual(expected);
	});

	it.each([
		["unapplied self-defaults are safe", "type Loop2<T = T> = Record<string, T>; type A2 = Loop2;", false],
		[
			"recursive unions cannot be proven unsafe",
			"type Cycle3 = Cycle3 | string; type A3 = Record<string, Cycle3>;",
			false,
		],
		["records missing their value argument", "type A4 = Record<string>;", false],
		["bare utility values", "type A5 = Record<string, Partial>;", false],
		["pick without arguments", "type A6 = Pick;", false],
		["mapped types without annotations", "type A7 = { [K in string] };", false],
	])("dictionary safety: $1", (_name, code, expectUnsafe) => {
		expect.assertions(1);

		const fixture = setup(code);
		let reported = false;
		traverseAst(fixture.source.ast, {
			TSMappedType(node: HarnessNode) {
				if (
					isNode(node) &&
					node.type === "TSMappedType" &&
					classifyUnsafeDictionary(node, fixture.environment) !== undefined
				)
					{reported = true;}
			},
			TSTypeLiteral(node: HarnessNode) {
				if (
					isNode(node) &&
					node.type === "TSTypeLiteral" &&
					classifyUnsafeDictionary(node, fixture.environment) !== undefined
				)
					{reported = true;}
			},
			TSTypeReference(node: HarnessNode) {
				if (
					isNode(node) &&
					node.type === "TSTypeReference" &&
					classifyUnsafeDictionary(node, fixture.environment) !== undefined
				)
					{reported = true;}
			},
		});
		expect(reported).toBe(expectUnsafe);
	});
});
