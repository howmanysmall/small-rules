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

import type { TypeEnvironment } from "$oxc-utilities/anti-slop/dictionary-types";
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
	throw new Error("Source AST is not a program node.");
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

describe("classifyUnsafeDictionary", () => {
	it.each([
		[
			"caller and callee parameters with the same name",
			"type Inner<T> = T; type Outer<T> = Record<string, Inner<T>>; let value: Outer<unknown>;",
			"unknown",
		],
		[
			"a structured explicit wrapper argument",
			"type Identity<Value> = Value; type Outer<T> = Record<string, Identity<Readonly<T>>>; let value: Outer<unknown>;",
			"unknown",
		],
		[
			"a dependent generic default",
			"type Select<T, U = T> = U; type Outer<T> = Record<string, Select<T>>; let value: Outer<unknown>;",
			"unknown",
		],
		[
			"multilevel generic forwarding",
			"type Identity<T> = T; type Middle<T> = Identity<T>; type Outer<T> = Record<string, Middle<T>>; let value: Outer<unknown>;",
			"unknown",
		],
		[
			"a generic parameter named Readonly",
			"type Outer<Readonly> = Record<string, Readonly>; let value: Outer<unknown>;",
			"unknown",
		],
	])("resolves unsafe values through $1", (_name, code, expected) => {
		expect.assertions(1);

		const fixture = setup(code);
		const target = findIdentifierReference(fixture.source, "Outer");

		expect(classifyUnsafeDictionary(target, fixture.environment)?.unsafeValue).toBe(expected);
	});

	it.each([
		[
			"an unrelated alias",
			"type T = Command; type Inner = Record<string, T>; type Outer<T> = Inner; let value: Outer<unknown>;",
		],
		[
			"a captured alias cycle",
			"type Identity<T> = T; type Cycle<T> = Identity<Cycle<T>>; type Outer<T> = Record<string, Cycle<T>>; let value: Outer<unknown>;",
		],
		[
			"a nested mapped binder",
			"interface Source { value: string } type Outer<T> = { [T in keyof Source]: T }; let value: Outer<unknown>;",
		],
	])("keeps $1 conservative and terminating", (_name, code) => {
		expect.assertions(1);

		const fixture = setup(code);
		const target = findIdentifierReference(fixture.source, "Outer");

		expect(classifyUnsafeDictionary(target, fixture.environment)).toBeUndefined();
	});

	it.each([
		[
			"merged empty interfaces",
			"interface Empty {} interface Empty {} let value: Record<string, Empty>;",
			"empty-object",
		],
		[
			"an empty and populated merge",
			"interface Empty {} interface Empty { value: string } let value: Record<string, Empty>;",
			undefined,
		],
		[
			"an extended interface",
			"interface Owner {} interface Empty extends Owner {} let value: Record<string, Empty>;",
			undefined,
		],
		[
			"an alias competitor",
			"interface Empty {} type Empty = Command; let value: Record<string, Empty>;",
			undefined,
		],
		["a class competitor", "interface Empty {} class Empty {} let value: Record<string, Empty>;", undefined],
	])("classifies $1 through visible declarations", (_name, code, expected) => {
		expect.assertions(1);

		const fixture = setup(code);
		const record = findIdentifierReference(fixture.source, "Record");

		expect(classifyUnsafeDictionary(record, fixture.environment)?.unsafeValue).toBe(expected);
	});

	it("uses local interface shadows for dictionary values", () => {
		expect.assertions(2);

		const empty = setup(
			"interface Item { value: string } function run() { interface Item {} let value: Record<string, Item>; }",
		);
		const populated = setup(
			"interface Item {} function run() { interface Item { value: string } let value: Record<string, Item>; }",
		);

		expect(
			classifyUnsafeDictionary(findIdentifierReference(empty.source, "Record"), empty.environment)?.unsafeValue,
		).toBe("empty-object");
		expect(
			classifyUnsafeDictionary(findIdentifierReference(populated.source, "Record"), populated.environment),
		).toBeUndefined();
	});

	it("merges reopened namespace interfaces for dictionary values", () => {
		expect.assertions(1);

		const fixture = setup(
			"namespace Owner { export interface Empty {} } namespace Owner { export interface Empty {} let value: Record<string, Empty>; }",
		);

		expect(
			classifyUnsafeDictionary(findIdentifierReference(fixture.source, "Record"), fixture.environment)
				?.unsafeValue,
		).toBe("empty-object");
	});

	it("uses global fallback and module precedence for interface values", () => {
		expect.assertions(2);

		const fixture = setup(
			[
				"export {}; interface Item { module: string }",
				"declare global { interface Item {} let inside: Record<string, Item>; }",
				"let outside: Record<string, Item>;",
			].join("\n"),
		);

		expect(
			classifyUnsafeDictionary(getNthNamedTypeReference(fixture.source, "Record", 0), fixture.environment)
				?.unsafeValue,
		).toBe("empty-object");
		expect(
			classifyUnsafeDictionary(getNthNamedTypeReference(fixture.source, "Record", 1), fixture.environment),
		).toBeUndefined();
	});

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
		const classified = findFirstClassifiable(fixture.source, fixture.environment);

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
			expect(checkReportedInConcrete(fixture.source, fixture.environment)).toBe(false);
		}
	});

	it("propagates unsafe values through Pick and Omit of an unsafe dictionary", () => {
		expect.assertions(2);

		for (const wrapper of ["Pick", "Omit"]) {
			const fixture = setup(`type Source = Record<string, unknown>; type A = ${wrapper}<Source, never>;`);
			const pickReference = getNthTypeReference(fixture.source, 1);
			expect(classifyUnsafeDictionary(pickReference, fixture.environment)).toBeDefined();
		}
	});

	// Catches a recursive alias hanging or silently exempting an
	// unknown-valued dictionary. Completion proves termination.
	it("classifies a dictionary whose value type is a self-referential union and terminates", () => {
		expect.assertions(1);

		const fixture = setup("type Cycle = Cycle | unknown; type A = Record<string, Cycle>;");
		const recordReference = getNthTypeReference(fixture.source, 1);

		expect(classifyUnsafeDictionary(recordReference, fixture.environment)).toStrictEqual({
			kind: "unsafe-dictionary",
			unsafeValue: "union",
		});
	});
});

describe("classifyUnsafeDictionaryValue", () => {
	it("classifies direct value types including intersections and wrappers", () => {
		expect.assertions(6);

		const plainUnknown = setup("type A = Record<string, unknown>;");
		const recordValue = requireFirstOfType(collectTypes(plainUnknown.source), "TSUnknownKeyword");
		expect(classifyUnsafeDictionaryValue(recordValue, plainUnknown.environment)?.unsafeValue).toBe("unknown");

		const wrapped = setup("type A = { [key: string]: Required<unknown> };");
		const wrappedValue = requireFirstOfType(collectTypes(wrapped.source), "TSUnknownKeyword");
		expect(classifyUnsafeDictionaryValue(wrappedValue, wrapped.environment)?.unsafeValue).toBe("unknown");

		const ownerIntersection = setup(
			"interface Owner { readonly id: string } type A = Record<string, unknown & Owner>;",
		);
		const intersection = requireFirstOfType(collectTypes(ownerIntersection.source), "TSIntersectionType");
		expect(classifyUnsafeDictionaryValue(intersection, ownerIntersection.environment)).toBeUndefined();

		const anyIntersection = setup("interface Owner { readonly id: string } type A = Record<string, any & Owner>;");
		const anyIntersectionType = requireFirstOfType(collectTypes(anyIntersection.source), "TSIntersectionType");
		expect(classifyUnsafeDictionaryValue(anyIntersectionType, anyIntersection.environment)?.unsafeValue).toBe(
			"any",
		);

		const optionalNeverInterface = setup(
			"interface Brand { readonly __brand?: never } type A = Record<string, Brand>;",
		);
		const brandReference = findIdentifierReference(optionalNeverInterface.source, "Brand");
		expect(classifyUnsafeDictionaryValue(brandReference, optionalNeverInterface.environment)?.unsafeValue).toBe(
			"empty-object",
		);

		const mergedInterfaces = setup(
			"interface Escape {} interface Escape { readonly id: string } type A = Record<string, Escape>;",
		);
		const escapeReference = findIdentifierReference(mergedInterfaces.source, "Escape");
		expect(classifyUnsafeDictionaryValue(escapeReference, mergedInterfaces.environment)).toBeUndefined();
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

function requireFirstOfType(types: ReadonlyArray<ESTree.TSType>, nodeType: string): ESTree.TSType {
	for (const candidate of types) {
		if (candidate.type === nodeType) return candidate;
	}
	const error = new Error(`Node of type "${nodeType}" not found.`);
	Error.captureStackTrace(error, requireFirstOfType);
	throw error;
}

function findIdentifierReference(source: HarnessSourceCode, name: string): ESTree.TSTypeReference {
	let found: ESTree.TSTypeReference | undefined;
	traverseAst(source.ast, {
		TSTypeReference(node: HarnessNode) {
			if (
				isNode(node) &&
				node.type === "TSTypeReference" &&
				node.typeName.type === "Identifier" &&
				node.typeName.name === name
			) {
				found ??= node;
			}
		},
	});
	if (found === undefined) {
		const error = new Error(`Reference "${name}" not found.`);
		Error.captureStackTrace(error, findIdentifierReference);
		throw error;
	}
	return found;
}

function getNthTypeReference(source: HarnessSourceCode, index: number): ESTree.TSTypeReference {
	const references = new Array<ESTree.TSTypeReference>();
	traverseAst(source.ast, {
		TSTypeReference(node: HarnessNode) {
			if (isNode(node) && node.type === "TSTypeReference") references.push(node);
		},
	});
	const reference = references[index];
	if (reference === undefined) {
		const error = new Error(`Type reference at index ${index} not found.`);
		Error.captureStackTrace(error, getNthTypeReference);
		throw error;
	}
	return reference;
}

function findFirstClassifiable(
	source: HarnessSourceCode,
	environment: TypeEnvironment,
): ReturnType<typeof classifyUnsafeDictionary> | undefined {
	let result: ReturnType<typeof classifyUnsafeDictionary> | undefined;
	traverseAst(source.ast, {
		TSMappedType(node: HarnessNode) {
			if (result === undefined && isNode(node) && node.type === "TSMappedType") {
				result = classifyUnsafeDictionary(node, environment);
			}
		},
		TSTypeLiteral(node: HarnessNode) {
			if (result === undefined && isNode(node) && node.type === "TSTypeLiteral") {
				result = classifyUnsafeDictionary(node, environment);
			}
		},
		TSTypeReference(node: HarnessNode) {
			if (result === undefined && isNode(node) && node.type === "TSTypeReference") {
				result = classifyUnsafeDictionary(node, environment);
			}
		},
	});
	return result;
}

function checkReportedInConcrete(source: HarnessSourceCode, environment: TypeEnvironment): boolean {
	let reported = false;
	traverseAst(source.ast, {
		TSTypeLiteral(node: HarnessNode) {
			if (
				isNode(node) &&
				node.type === "TSTypeLiteral" &&
				classifyUnsafeDictionary(node, environment) !== undefined
			) {
				reported = true;
			}
		},
		TSTypeReference(node: HarnessNode) {
			if (
				isNode(node) &&
				node.type === "TSTypeReference" &&
				classifyUnsafeDictionary(node, environment) !== undefined
			) {
				reported = true;
			}
		},
	});
	return reported;
}

function checkDictionaryReported(source: HarnessSourceCode, environment: TypeEnvironment): boolean {
	let reported = false;
	traverseAst(source.ast, {
		TSMappedType(node: HarnessNode) {
			if (
				isNode(node) &&
				node.type === "TSMappedType" &&
				classifyUnsafeDictionary(node, environment) !== undefined
			) {
				reported = true;
			}
		},
		TSTypeLiteral(node: HarnessNode) {
			if (
				isNode(node) &&
				node.type === "TSTypeLiteral" &&
				classifyUnsafeDictionary(node, environment) !== undefined
			) {
				reported = true;
			}
		},
		TSTypeReference(node: HarnessNode) {
			if (
				isNode(node) &&
				node.type === "TSTypeReference" &&
				classifyUnsafeDictionary(node, environment) !== undefined
			) {
				reported = true;
			}
		},
	});
	return reported;
}

interface TypeFixture {
	readonly environment: ReturnType<typeof createTypeEnvironment>;
	readonly source: HarnessSourceCode;
}

function setup(code: string): TypeFixture {
	const source = parseCode(code);
	return { environment: createTypeEnvironment(getProgram(source), source.visitorKeys), source };
}

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

function getFirstTypeLiteral(source: HarnessSourceCode): ESTree.TSTypeLiteral {
	let found: ESTree.TSTypeLiteral | undefined;
	traverseAst(source.ast, {
		TSTypeLiteral(node: HarnessNode) {
			if (isNode(node) && node.type === "TSTypeLiteral") found ??= node;
		},
	});
	if (found === undefined) {
		const error = new Error("Type literal not found.");
		Error.captureStackTrace(error, getFirstTypeLiteral);
		throw error;
	}
	return found;
}

function clearIndexTypeAnnotations(literal: ESTree.TSTypeLiteral): ESTree.TSTypeLiteral {
	for (const member of literal.members) {
		if (member.type === "TSIndexSignature") {
			Reflect.set(member, "typeAnnotation", null);
		}
	}
	return literal;
}

describe("classifyWideningTarget", () => {
	it.each([
		[
			"a transparent generic key alias",
			"type Key<Value> = Value; type Index<T> = Record<Key<T>, Command>; let value: Index<string>;",
			"generic container",
		],
		[
			"a structured broad union key",
			"type Key<T> = T; type Index<T> = Record<Key<T | 'start'>, Command>; let value: Index<string>;",
			"generic container",
		],
		[
			"multilevel key forwarding",
			"type Key<T> = T; type Middle<T> = Key<T>; type Index<T> = Record<Middle<T>, Command>; let value: Index<string>;",
			"generic container",
		],
		[
			"same-name key capture",
			"type Key<T> = T; type Index<T> = Record<Key<T>, Command>; let value: Index<string>;",
			"generic container",
		],
		["keyof any", "type Index<T> = Record<keyof any, T>; let value: Index<Command>;", "generic container"],
	])("classifies $1 as broad", (_name, code, expected) => {
		expect.assertions(1);

		const fixture = setup(code);
		const target = findIdentifierReference(fixture.source, "Index");

		expect(classifyWideningTarget(target, fixture.environment)?.kind).toBe(expected);
	});

	it.each([
		["any", "let value: Record<any, Command>;"],
		["never", "let value: Record<never, Command>;"],
		["an enum", "enum Key { Start } let value: Record<Key, Command>;"],
		["a unique symbol", "declare const key: unique symbol; let value: Record<typeof key, Command>;"],
	])("keeps %s Record keys finite or conservative", (_name, code) => {
		expect.assertions(1);

		const fixture = setup(code);

		expect(
			classifyWideningTarget(findIdentifierReference(fixture.source, "Record"), fixture.environment),
		).toBeUndefined();
	});

	it.each([
		["a missing key", "const value: Record = {};", "open dictionary"],
		["a string key", "const value: Record<string, Command> = {};", "open dictionary"],
		["PropertyKey", "const value: Record<PropertyKey, Command> = {};", "open dictionary"],
		["a mixed broad union", "const value: Record<string | 'start', Command> = {};", "open dictionary"],
		["a literal union", "const value: Record<'start' | 'stop', Command> = {};", undefined],
	])("classifies Record with %s from its key domain", (_name, code, expected) => {
		expect.assertions(1);

		const fixture = setup(code);
		expect(classifyWideningTarget(getFirstAnnotationTarget(fixture.source), fixture.environment)?.kind).toBe(
			expected,
		);
	});

	it.each([
		["an alias to string", "type Key = string; const value: Record<Key, Command> = {};", "open dictionary"],
		[
			"a chained alias to string",
			"type Broad = string; type Key = Broad; const value: Record<Key, Command> = {};",
			"open dictionary",
		],
		[
			"an alias to a literal union",
			"type Key = 'start' | 'stop'; const value: Record<Key, Command> = {};",
			undefined,
		],
		["a cyclic key alias", "type Key = Key; const value: Record<Key, Command> = {};", undefined],
		[
			"an ambiguous key alias",
			"type Key = string; type Key = 'start'; const value: Record<Key, Command> = {};",
			undefined,
		],
	])("classifies Record through %s", (_name, code, expected) => {
		expect.assertions(1);

		const fixture = setup(code);
		expect(classifyWideningTarget(getFirstAnnotationTarget(fixture.source), fixture.environment)?.kind).toBe(
			expected,
		);
	});

	it.each([
		[
			"a finite generic Record key",
			"type Index<Key, Value> = Record<Key, Value>; const value: Index<'start', Command> = {};",
			undefined,
		],
		[
			"a substituted open dictionary",
			"type Identity<Value> = Value; const value: Identity<Record<string, Command>> = {};",
			"generic container",
		],
		[
			"a finite Record body",
			"type Index<Value> = Record<'start', Value>; const value: Index<Command> = {};",
			undefined,
		],
	])("classifies generic alias with %s", (_name, code, expected) => {
		expect.assertions(1);

		const fixture = setup(code);
		expect(classifyWideningTarget(getFirstAnnotationTarget(fixture.source), fixture.environment)?.kind).toBe(
			expected,
		);
	});

	it("applies lexical Record shadows only where they are visible", () => {
		expect.assertions(4);

		const fixture = setup(
			[
				"function local() { type Record<K, V> = { key: K; value: V }; let value: Record<string, Command>; }",
				"namespace Owner { type Record<K, V> = { key: K; value: V }; let value: Record<string, Command>; }",
				"let sibling: Record<string, Command>;",
				"let final: Record<string, Command>;",
			].join("\n"),
		);

		expect(
			classifyWideningTarget(getNthNamedTypeReference(fixture.source, "Record", 0), fixture.environment),
		).toBeUndefined();
		expect(
			classifyWideningTarget(getNthNamedTypeReference(fixture.source, "Record", 1), fixture.environment),
		).toBeUndefined();
		expect(
			classifyWideningTarget(getNthNamedTypeReference(fixture.source, "Record", 2), fixture.environment)?.kind,
		).toBe("open dictionary");
		expect(
			classifyWideningTarget(getNthNamedTypeReference(fixture.source, "Record", 3), fixture.environment)?.kind,
		).toBe("open dictionary");
	});

	it("suppresses built-in classification for a competing global Record binding", () => {
		expect.assertions(1);

		const fixture = setup(
			"export {}; declare global { interface Record<K, V> {} } const value: Record<string, Command> = {};",
		);

		expect(classifyWideningTarget(getFirstAnnotationTarget(fixture.source), fixture.environment)).toBeUndefined();
	});

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
		).toStrictEqual({ kind: "open dictionary" });

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
		expect.assertions(1);

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
			"open dictionary",
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
		expect(checkDictionaryReported(fixture.source, fixture.environment)).toBe(expectUnsafe);
	});

	it("ignores index signatures with missing type annotations", () => {
		expect.assertions(1);

		const fixture = setup("type A = { [key: string]: unknown };");
		const literal = clearIndexTypeAnnotations(getFirstTypeLiteral(fixture.source));

		expect(classifyUnsafeDictionary(literal, fixture.environment)).toBeUndefined();
	});

	it("substitutes a generic Readonly value before recognizing built-in wrappers", () => {
		expect.assertions(1);

		const fixture = setup(
			"type Index<Readonly> = Record<string, Readonly>; type Values = Index<unknown>; let values: Values;",
		);
		const values = findIdentifierReference(fixture.source, "Values");

		expect(classifyUnsafeDictionary(values, fixture.environment)?.unsafeValue).toBe("unknown");
	});
});

function getNthNamedTypeReference(source: HarnessSourceCode, name: string, index: number): ESTree.TSTypeReference {
	const references = new Array<ESTree.TSTypeReference>();
	traverseAst(source.ast, {
		TSTypeReference(node: HarnessNode) {
			if (
				isNode(node) &&
				node.type === "TSTypeReference" &&
				node.typeName.type === "Identifier" &&
				node.typeName.name === name
			) {
				references.push(node);
			}
		},
	});
	const reference = references[index];
	if (reference !== undefined) return reference;
	const error = new Error(`Type reference "${name}" at index ${index} not found.`);
	Error.captureStackTrace(error, getNthNamedTypeReference);
	throw error;
}
