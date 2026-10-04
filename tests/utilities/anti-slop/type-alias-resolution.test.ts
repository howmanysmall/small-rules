import { describe, expect, it } from "vitest";

import {
	continueTypeResolution,
	createTypeAliasEnvironment,
	createTypeResolution,
	getResolvedTypeMatches,
	getVisibleInterfaceDeclarations,
	getVisibleTypeAlias,
	hasVisibleTypeBinding,
	resolveTypeReference,
} from "$oxc-utilities/anti-slop/type-alias-resolution";
import { isNode } from "$oxc-utilities/oxc-utilities";
import { traverseAst } from "$test/rule-harness/ast";
import { parseCase } from "$test/rule-harness/parse";

import type { ESTree } from "oxlint-plugin-utilities";

import type { ResolvedTypeMatcher, TypeResolution } from "$oxc-utilities/anti-slop/type-alias-resolution";
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

function findTypeReference(source: HarnessSourceCode, name: string): ESTree.TSTypeReference {
	return findNthTypeReference(source, name, 0);
}

function findNthTypeReference(source: HarnessSourceCode, name: string, index: number): ESTree.TSTypeReference {
	const found = new Array<ESTree.TSTypeReference>();
	traverseAst(source.ast, {
		TSTypeReference(node: HarnessNode) {
			if (
				isNode(node) &&
				node.type === "TSTypeReference" &&
				node.typeName.type === "Identifier" &&
				node.typeName.name === name
			) {
				found.push(node);
			}
		},
	});
	const reference = found[index];
	if (reference === undefined) {
		throw new Error(`Type reference "${name}" at index ${index} not found.`);
	}
	return reference;
}

function findQualifiedTypeReference(source: HarnessSourceCode): ESTree.TSTypeReference {
	let found: ESTree.TSTypeReference | undefined;
	traverseAst(source.ast, {
		TSTypeReference(node: HarnessNode) {
			if (isNode(node) && node.type === "TSTypeReference" && node.typeName.type === "TSQualifiedName") {
				found ??= node;
			}
		},
	});
	if (found === undefined) {
		throw new Error("Qualified type reference not found.");
	}
	return found;
}

function getAnnotationType(alias?: ESTree.TSTypeAliasDeclaration): string | undefined {
	return alias?.typeAnnotation.type;
}

const matchesUnknown: ResolvedTypeMatcher = function matchesUnknown(resolved, enqueue) {
	if (resolved.type === "TSUnknownKeyword") return true;
	if (resolved.type === "TSParenthesizedType") {
		enqueue(resolved.typeAnnotation);
		return false;
	}
	if (resolved.type === "TSUnionType") {
		for (const member of resolved.types) enqueue(member);
		return false;
	}
	if (resolved.type === "TSFunctionType") {
		enqueue(resolved.returnType.typeAnnotation);
		return false;
	}
	if (resolved.type === "TSMappedType") {
		if (resolved.typeAnnotation !== null) enqueue(resolved.typeAnnotation);
		return false;
	}
	if (resolved.type === "TSConditionalType") {
		enqueue(resolved.trueType);
		return false;
	}
	return false;
};

function doesReferenceResolveToUnknown(code: string, name: string, index = 0): boolean {
	const source = parseCode(code);
	const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
	return getResolvedTypeMatches(findNthTypeReference(source, name, index), environment, matchesUnknown);
}

describe("visibleTypeAlias", () => {
	// Catches a module alias being unavailable at a lexical use site.
	// The expected declaration follows TypeScript's module type namespace.
	it("collects known module and nested aliases in the public field", () => {
		expect.assertions(3);

		const source = parseCode(
			[
				"type Payload = unknown;",
				"function first() { type Duplicate = string; }",
				"function second() { type Duplicate = number; }",
				"let value: Payload;",
			].join("\n"),
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const use = findTypeReference(source, "Payload");
		const alias = getVisibleTypeAlias("Payload", use, environment);

		expect(environment.aliases.map((candidate) => candidate.id.name).toSorted()).toStrictEqual([
			"Duplicate",
			"Duplicate",
			"Payload",
		]);
		expect(
			environment.aliases
				.filter((candidate) => candidate.id.name === "Duplicate")
				.map((candidate) => candidate.typeAnnotation.type)
				.toSorted(),
		).toStrictEqual(["TSNumberKeyword", "TSStringKeyword"]);
		expect(getAnnotationType(alias)).toBe("TSUnknownKeyword");
	});

	it("hoists an alias throughout its enclosing block", () => {
		expect.assertions(1);

		const source = parseCode("function run() { let value: Local; type Local = string; }");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const use = findTypeReference(source, "Local");
		const alias = getVisibleTypeAlias("Local", use, environment);

		expect(getAnnotationType(alias)).toBe("TSStringKeyword");
	});

	it("hoists a module alias declared after its use", () => {
		expect.assertions(1);

		const source = parseCode("let value: Local; type Local = string;");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const use = findTypeReference(source, "Local");
		const alias = getVisibleTypeAlias("Local", use, environment);

		expect(getAnnotationType(alias)).toBe("TSStringKeyword");
	});

	it.each([
		["block", ["type Item = string;", "{ type Item = number; let nested: Item; }", "let outer: Item;"].join("\n")],
		[
			"module",
			[
				"type Item = string;",
				"namespace Owner { type Item = number; let nested: Item; }",
				"let outer: Item;",
			].join("\n"),
		],
		[
			"static block",
			[
				"type Item = string;",
				"class Owner { static { type Item = number; let nested: Item; } }",
				"let outer: Item;",
			].join("\n"),
		],
		[
			"switch statement",
			[
				"type Item = string;",
				"switch (input) { case 0: type Item = number; let nested: Item; }",
				"let outer: Item;",
			].join("\n"),
		],
	])("keeps same-name aliases within the nearest %s scope", (_name, code) => {
		expect.assertions(2);

		const source = parseCode(code);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const nestedUse = findNthTypeReference(source, "Item", 0);
		const outerUse = findNthTypeReference(source, "Item", 1);
		const nestedAlias = getVisibleTypeAlias("Item", nestedUse, environment);
		const outerAlias = getVisibleTypeAlias("Item", outerUse, environment);

		expect(getAnnotationType(nestedAlias)).toBe("TSNumberKeyword");
		expect(getAnnotationType(outerAlias)).toBe("TSStringKeyword");
	});

	it("treats equal-distance duplicate bindings as ambiguous", () => {
		expect.assertions(2);

		const source = parseCode("type Choice = string; type Choice = number; let value: Choice;");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const use = findTypeReference(source, "Choice");

		expect(getVisibleTypeAlias("Choice", use, environment)).toBeUndefined();
		expect(hasVisibleTypeBinding("Choice", use, environment)).toBe(true);
	});

	it.each([
		["interface", "interface Record {} let value: Record;"],
		["enum", "enum Record {} let value: Record;"],
		["class", "class Record {} let value: Record;"],
		["named import", 'import { Record } from "./owner"; let value: Record;'],
		["default import", 'import Record from "./owner"; let value: Record;'],
		["namespace import", 'import * as Record from "./owner"; let value: Record;'],
	])("recognizes a visible %s type binding", (_name, code) => {
		expect.assertions(2);

		const source = parseCode(code);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const use = findTypeReference(source, "Record");

		expect(hasVisibleTypeBinding("Record", use, environment)).toBe(true);
		expect(getVisibleTypeAlias("Record", use, environment)).toBeUndefined();
	});

	it.each([
		["external-module import-equals", 'import Record = require("./record"); let value: Record;'],
		["qualified-name import-equals", "import Record = Owner.Record; let value: Record;"],
		["identifier namespace", "namespace Record {} let value: Record;"],
		["identifier module", "module Record {} let value: Record;"],
	])("recognizes a visible %s binding", (_name, code) => {
		expect.assertions(1);

		const source = parseCode(code);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(hasVisibleTypeBinding("Record", findTypeReference(source, "Record"), environment)).toBe(true);
	});

	it("binds only the leftmost identifier of a qualified namespace", () => {
		expect.assertions(2);

		const source = parseCode("namespace Record.Inner {} let outer: Record; let nested: Inner;");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(hasVisibleTypeBinding("Record", findTypeReference(source, "Record"), environment)).toBe(true);
		expect(hasVisibleTypeBinding("Inner", findTypeReference(source, "Inner"), environment)).toBe(false);
	});

	it.each([
		["string-literal ambient module", 'declare module "record" {} let value: Record;', "Record"],
		["global declaration", "export {}; declare global {} let value: global;", "global"],
	])("does not invent a binding for a %s", (_name, code, referenceName) => {
		expect.assertions(1);

		const source = parseCode(code);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(hasVisibleTypeBinding(referenceName, findTypeReference(source, referenceName), environment)).toBe(false);
	});

	it("does not place a value-only function in the type namespace", () => {
		expect.assertions(1);

		const source = parseCode("function Record() {} let value: Record;");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(hasVisibleTypeBinding("Record", findTypeReference(source, "Record"), environment)).toBe(false);
	});

	it("lets a type parameter shadow an outer alias", () => {
		expect.assertions(2);

		const source = parseCode("type Identity = unknown; function run<Identity>(value: Identity): void {}");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const use = findTypeReference(source, "Identity");

		expect(getVisibleTypeAlias("Identity", use, environment)).toBeUndefined();
		expect(hasVisibleTypeBinding("Identity", use, environment)).toBe(true);
	});

	it("limits a named class expression type binding to that class", () => {
		expect.assertions(4);

		const source = parseCode(
			"const Local = class Record { value!: Record }; let outside: Record<string, unknown>;",
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const inside = findNthTypeReference(source, "Record", 0);
		const outside = findNthTypeReference(source, "Record", 1);

		expect(hasVisibleTypeBinding("Record", inside, environment)).toBe(true);
		expect(getVisibleTypeAlias("Record", inside, environment)).toBeUndefined();
		expect(hasVisibleTypeBinding("Record", outside, environment)).toBe(false);
		expect(getVisibleTypeAlias("Record", outside, environment)).toBeUndefined();
	});

	it("does not invent a type binding for an anonymous class expression", () => {
		expect.assertions(1);

		const source = parseCode("const Local = class { value!: Record };");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(hasVisibleTypeBinding("Record", findTypeReference(source, "Record"), environment)).toBe(false);
	});

	it("hoists a declaration from a same-file global augmentation", () => {
		expect.assertions(2);

		const source = parseCode("export {}; let before: Shared; declare global { type Shared = unknown; }");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const use = findTypeReference(source, "Shared");
		const alias = getVisibleTypeAlias("Shared", use, environment);

		expect(hasVisibleTypeBinding("Shared", use, environment)).toBe(true);
		expect(getAnnotationType(alias)).toBe("TSUnknownKeyword");
	});

	it("hoists a competing binding from a same-file global augmentation", () => {
		expect.assertions(2);

		const source = parseCode("export {}; let before: Shared; declare global { interface Shared {} }");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const use = findTypeReference(source, "Shared");

		expect(hasVisibleTypeBinding("Shared", use, environment)).toBe(true);
		expect(getVisibleTypeAlias("Shared", use, environment)).toBeUndefined();
	});

	it("lets a module alias shadow a same-name global binding", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				"export {}; type Shared = unknown; declare global { interface Shared {} } let value: Shared;",
				"Shared",
			),
		).toBe(true);
	});

	it("prefers global bindings inside an augmentation and module bindings outside", () => {
		expect.assertions(2);

		const source = parseCode(
			[
				"export {}; type Shared = string;",
				"declare global { type Shared = unknown; let inside: Shared; }",
				"let outside: Shared;",
			].join("\n"),
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const inside = getVisibleTypeAlias("Shared", findNthTypeReference(source, "Shared", 0), environment);
		const outside = getVisibleTypeAlias("Shared", findNthTypeReference(source, "Shared", 1), environment);

		expect(getAnnotationType(inside)).toBe("TSUnknownKeyword");
		expect(getAnnotationType(outside)).toBe("TSStringKeyword");
	});

	it("propagates global ambientness through reopened nested namespaces", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				[
					"export {}; declare global {",
					"namespace A { namespace B { type Shared = unknown; } }",
					"namespace A { namespace B { let value: Shared; } }",
					"}",
				].join("\n"),
				"Shared",
			),
		).toBe(true);
	});

	it("shares exported aliases across a reopened namespace", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				"namespace Owner { export type Shared = unknown; } namespace Owner { let value: Shared; }",
				"Shared",
			),
		).toBe(true);
	});

	it("does not share private aliases across a reopened namespace", () => {
		expect.assertions(2);

		const source = parseCode("namespace Owner { type Private = unknown; } namespace Owner { let value: Private; }");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const use = findTypeReference(source, "Private");

		expect(hasVisibleTypeBinding("Private", use, environment)).toBe(false);
		expect(getVisibleTypeAlias("Private", use, environment)).toBeUndefined();
	});

	it("keeps a private namespace alias visible in its own block", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown("namespace Owner { type Private = unknown; let value: Private; }", "Private"),
		).toBe(true);
	});

	it.each([
		["interface", "export interface Shared {}"],
		["enum", "export enum Shared {}"],
		["class", "export class Shared {}"],
		["namespace", "export namespace Shared {}"],
	])("lets an exported %s block an outer alias across namespace declarations", (_name, declaration) => {
		expect.assertions(2);

		const source = parseCode(
			`type Shared = unknown; namespace Owner { ${declaration} } namespace Owner { let value: Shared; }`,
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const use = findTypeReference(source, "Shared");

		expect(hasVisibleTypeBinding("Shared", use, environment)).toBe(true);
		expect(getVisibleTypeAlias("Shared", use, environment)).toBeUndefined();
	});

	it("shares exported aliases across reopened nested namespaces", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				[
					"namespace A { export namespace B { export type Shared = unknown; } }",
					"namespace A { export namespace B { let value: Shared; } }",
				].join("\n"),
				"Shared",
			),
		).toBe(true);
	});

	it("merges private nested namespaces reopened in one concrete parent block", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				[
					"namespace A {",
					"namespace B { export type Shared = unknown; }",
					"namespace B { let value: Shared; }",
					"}",
				].join("\n"),
				"Shared",
			),
		).toBe(true);
	});

	it("keeps private nested namespaces isolated across reopened parent blocks", () => {
		expect.assertions(1);

		const source = parseCode(
			[
				"namespace A { namespace B { export type Shared = unknown; } }",
				"namespace A { namespace B { let value: Shared; } }",
			].join("\n"),
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(getVisibleTypeAlias("Shared", findTypeReference(source, "Shared"), environment)).toBeUndefined();
	});

	it("merges qualified private namespace paths within one parent block", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				[
					"namespace Parent {",
					"namespace A.B { export type Shared = unknown; }",
					"namespace A.B { let value: Shared; }",
					"}",
				].join("\n"),
				"Shared",
			),
		).toBe(true);
	});

	it("merges qualified and exported nested namespace declarations", () => {
		expect.assertions(2);

		const code = [
			"namespace A.B { export type FromQualified = unknown; let nested: FromNested; }",
			"namespace A { export namespace B { export type FromNested = unknown; let qualified: FromQualified; } }",
		].join("\n");

		expect(doesReferenceResolveToUnknown(code, "FromNested")).toBe(true);
		expect(doesReferenceResolveToUnknown(code, "FromQualified")).toBe(true);
	});

	it("implicitly shares members across ambient identifier namespaces", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				"declare namespace Ambient { type Shared = unknown; } declare namespace Ambient { let value: Shared; }",
				"Shared",
			),
		).toBe(true);
	});

	it("does not merge a string-literal ambient module with an identifier namespace", () => {
		expect.assertions(1);

		const source = parseCode(
			'declare module "Owner" { type Shared = unknown; } namespace Owner { let value: Shared; }',
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(getVisibleTypeAlias("Shared", findTypeReference(source, "Shared"), environment)).toBeUndefined();
	});

	it("isolates identifier namespaces nested in string-literal modules", () => {
		expect.assertions(1);

		const source = parseCode(
			[
				'declare module "package" { namespace Owner { export type Shared = unknown; } }',
				"namespace Owner { let value: Shared; }",
			].join("\n"),
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(getVisibleTypeAlias("Shared", findTypeReference(source, "Shared"), environment)).toBeUndefined();
	});

	it("merges reopened namespaces within one string-literal ambient module", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				[
					'declare module "pkg" {',
					"namespace A { type X = unknown; }",
					"namespace A { let value: X; }",
					"}",
				].join("\n"),
				"X",
			),
		).toBe(true);
	});

	it("isolates namespaces across separate string-literal ambient modules", () => {
		expect.assertions(1);

		const source = parseCode(
			[
				'declare module "pkg" { namespace A { type X = unknown; } }',
				'declare module "pkg" { namespace A { let value: X; } }',
			].join("\n"),
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(getVisibleTypeAlias("X", findTypeReference(source, "X"), environment)).toBeUndefined();
	});

	it("does not invent a binding for a bodyless string-literal ambient module", () => {
		expect.assertions(1);

		const source = parseCode('declare module "pkg"; let value: Package;');
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(hasVisibleTypeBinding("Package", findTypeReference(source, "Package"), environment)).toBe(false);
	});

	it("keeps module-local and global namespace trees separate", () => {
		expect.assertions(2);

		const source = parseCode(
			[
				"export {}; namespace Scope { export type Local = unknown; let local: Global; }",
				"declare global { namespace Scope { type Global = unknown; let global: Local; } }",
			].join("\n"),
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(getVisibleTypeAlias("Global", findTypeReference(source, "Global"), environment)).toBeUndefined();
		expect(getVisibleTypeAlias("Local", findTypeReference(source, "Local"), environment)).toBeUndefined();
	});
});

describe("visibleInterfaceDeclarations", () => {
	it("returns every declaration in a same-scope interface merge", () => {
		expect.assertions(1);

		const source = parseCode("interface Item {} interface Item { value: string } let item: Item;");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(getVisibleInterfaceDeclarations("Item", findTypeReference(source, "Item"), environment)).toHaveLength(2);
	});

	it("uses the nearest lexical interface declaration", () => {
		expect.assertions(2);

		const source = parseCode(
			"interface Item { outer: string } function run() { interface Item { local: string } let local: Item; } let outer: Item;",
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const local = getVisibleInterfaceDeclarations("Item", findNthTypeReference(source, "Item", 0), environment);
		const outer = getVisibleInterfaceDeclarations("Item", findNthTypeReference(source, "Item", 1), environment);

		expect(getInterfacePropertyNames(local)).toStrictEqual(["local"]);
		expect(getInterfacePropertyNames(outer)).toStrictEqual(["outer"]);
	});

	it("lets a type parameter shadow an interface", () => {
		expect.assertions(1);

		const source = parseCode("interface Item {} function run<Item>(value: Item): void {}");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(getVisibleInterfaceDeclarations("Item", findTypeReference(source, "Item"), environment)).toBeUndefined();
	});

	it.each([
		["alias", "interface Item {} type Item = string; let item: Item;"],
		["class", "interface Item {} class Item {} let item: Item;"],
	])("treats a same-scope %s as an interface competitor", (_name, code) => {
		expect.assertions(1);

		const source = parseCode(code);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(getVisibleInterfaceDeclarations("Item", findTypeReference(source, "Item"), environment)).toBeUndefined();
	});

	it("merges exported interfaces across reopened namespaces", () => {
		expect.assertions(1);

		const source = parseCode(
			"namespace Owner { export interface Shared {} } namespace Owner { export interface Shared { value: string } let item: Shared; }",
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(
			getVisibleInterfaceDeclarations("Shared", findTypeReference(source, "Shared"), environment),
		).toHaveLength(2);
	});

	it("keeps private interfaces isolated across reopened namespaces", () => {
		expect.assertions(1);

		const source = parseCode("namespace Owner { interface Private {} } namespace Owner { let item: Private; }");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(
			getVisibleInterfaceDeclarations("Private", findTypeReference(source, "Private"), environment),
		).toBeUndefined();
	});

	it("uses global interfaces as fallback outside an augmentation", () => {
		expect.assertions(1);

		const source = parseCode(
			"export {}; declare global { interface Shared { global: string } } let outside: Shared;",
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const declarations = getVisibleInterfaceDeclarations(
			"Shared",
			findTypeReference(source, "Shared"),
			environment,
		);

		expect(getInterfacePropertyNames(declarations)).toStrictEqual(["global"]);
	});

	it("prefers global bindings inside and module bindings outside an augmentation", () => {
		expect.assertions(2);

		const source = parseCode(
			[
				"export {}; interface Shared { module: string }",
				"declare global { interface Shared { global: string } let inside: Shared; }",
				"let outside: Shared;",
			].join("\n"),
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const inside = getVisibleInterfaceDeclarations(
			"Shared",
			findNthTypeReference(source, "Shared", 0),
			environment,
		);
		const outside = getVisibleInterfaceDeclarations(
			"Shared",
			findNthTypeReference(source, "Shared", 1),
			environment,
		);

		expect(getInterfacePropertyNames(inside)).toStrictEqual(["global"]);
		expect(getInterfacePropertyNames(outside)).toStrictEqual(["module"]);
	});
});

function getInterfacePropertyNames(
	declarations: ReadonlyArray<ESTree.TSInterfaceDeclaration> | undefined,
): Array<string> {
	const names = new Array<string>();
	const visibleDeclarations = declarations ?? [];
	for (const declaration of visibleDeclarations) {
		const { body } = declaration.body;
		for (const member of body) {
			if (member.type === "TSPropertySignature" && member.key.type === "Identifier") names.push(member.key.name);
		}
	}
	return names;
}

describe("resolvedTypeMatches", () => {
	it.each([
		["an explicit argument", "type Identity<T> = T; let value: Identity<unknown>;", "Identity", 0],
		["a default argument", "type Identity<T = unknown> = T; let value: Identity;", "Identity", 0],
		[
			"a nested alias",
			"type Identity<T> = T; type Wrapped<T> = Identity<T>; let value: Wrapped<unknown>;",
			"Wrapped",
			0,
		],
		[
			"a dependent default with a captured substitution",
			"type Select<T, U = T> = U; type Wrapped<V> = Select<V>; let value: Wrapped<unknown>;",
			"Wrapped",
			0,
		],
		[
			"a substitution that takes precedence over an outer alias",
			"type T = string; type Identity<T> = T; let value: Identity<unknown>;",
			"Identity",
			0,
		],
	])("resolves unknown through %s", (_name, code, referenceName, index) => {
		expect.assertions(1);

		expect(doesReferenceResolveToUnknown(code, referenceName, index)).toBe(true);
	});

	it("does not resolve a generic alias missing a required argument", () => {
		expect.assertions(1);

		expect(doesReferenceResolveToUnknown("type Identity<T> = T; let value: Identity;", "Identity")).toBe(false);
	});

	it("does not substitute a type-parameter reference that has type arguments", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				"type T = unknown; type Identity<T> = T<string>; let value: Identity<number>;",
				"Identity",
			),
		).toBe(false);
	});

	it("preserves substitutions when the matcher enqueues parenthesized union members", () => {
		expect.assertions(1);

		expect(doesReferenceResolveToUnknown("type Maybe<T> = (string | T); let value: Maybe<unknown>;", "Maybe")).toBe(
			true,
		);
	});

	it("resolves references in an alias body against that body's lexical scope", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				[
					"type Result = string;",
					"function run() { type Local = unknown; type Result = Local; let value: Result; }",
				].join("\n"),
				"Result",
			),
		).toBe(true);
	});

	it("does not rebind a qualified type reference", () => {
		expect.assertions(1);

		const source = parseCode(
			"type Value = unknown; declare namespace Owner { type Value = string } let value: Owner.Value;",
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);

		expect(getResolvedTypeMatches(findQualifiedTypeReference(source), environment, matchesUnknown)).toBe(false);
	});

	it("terminates a self-referential alias without a match", () => {
		expect.assertions(1);

		expect(doesReferenceResolveToUnknown("type Cycle = Cycle; let value: Cycle;", "Cycle", 1)).toBe(false);
	});

	it("does not leak caller substitutions into an unrelated alias", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				"type T = string; type Inner = T; type Outer<T> = Inner; let value: Outer<unknown>;",
				"Outer",
			),
		).toBe(false);
	});

	it("lets a nested function type parameter shadow an outer substitution", () => {
		expect.assertions(2);

		expect(doesReferenceResolveToUnknown("type Outer<T> = <T>() => T; let value: Outer<unknown>;", "Outer")).toBe(
			false,
		);
		expect(doesReferenceResolveToUnknown("type Outer<T> = () => T; let value: Outer<unknown>;", "Outer")).toBe(
			true,
		);
	});

	it("lets a mapped type parameter shadow an outer substitution", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				"interface Source { value: string } type Outer<T> = { [T in keyof Source]: T }; let value: Outer<unknown>;",
				"Outer",
			),
		).toBe(false);
	});

	it("lets a conditional infer parameter shadow an outer substitution", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				"type Outer<T> = T extends infer T ? T : never; let value: Outer<unknown>;",
				"Outer",
			),
		).toBe(false);
	});

	it("does not give a nested conditional's infer binder to its owner", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				[
					"type Outer<T> = T extends (unknown extends infer T ? unknown : never) ? T : never;",
					"type Result = Outer<unknown>;",
				].join("\n"),
				"Outer",
			),
		).toBe(true);
	});

	it("keeps a nested conditional's infer binder in its own true branch", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				[
					"type Outer<T> = T extends unknown ? (unknown extends infer T ? T : never) : never;",
					"type Result = Outer<unknown>;",
				].join("\n"),
				"Outer",
			),
		).toBe(false);
	});

	it("keeps an ordinary structural infer binder in its true branch", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				[
					"type Outer<T> = T extends { value: infer T } ? T : never;",
					"type Result = Outer<{ value: unknown }> ;",
				].join("\n"),
				"Outer",
			),
		).toBe(false);
	});

	it("resolves an alias nested inside an explicit argument", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown("type Identity<T> = T; let value: Identity<Identity<unknown>>;", "Identity"),
		).toBe(true);
	});

	it.each([
		["direct", "type Cycle = Cycle; let value: Cycle;", "Cycle", 1],
		["mutual", "type Left = Right; type Right = Left; let value: Left;", "Left", 1],
		["generic", "type Cycle<T> = Cycle<T>; let value: Cycle<unknown>;", "Cycle", 1],
		["default argument", "type Cycle<T = Cycle> = T; let value: Cycle;", "Cycle", 1],
		["explicit argument", "type Identity<T> = T; type Cycle = Identity<Cycle>; let value: Cycle;", "Cycle", 1],
	])("terminates a %s alias cycle", (_name, code, referenceName, index) => {
		expect.assertions(1);

		expect(doesReferenceResolveToUnknown(code, referenceName, index)).toBe(false);
	});

	it("captures caller substitutions in forwarded explicit arguments", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown(
				"type Identity<T> = T; type Outer<T> = Identity<T>; let value: Outer<unknown>;",
				"Outer",
			),
		).toBe(true);
	});

	it("captures earlier parameters in dependent defaults", () => {
		expect.assertions(1);

		expect(doesReferenceResolveToUnknown("type Select<T, U = T> = U; let value: Select<unknown>;", "Select")).toBe(
			true,
		);
	});

	it("lets an explicit argument override its default", () => {
		expect.assertions(1);

		expect(
			doesReferenceResolveToUnknown("type Identity<T = string> = T; let value: Identity<unknown>;", "Identity"),
		).toBe(true);
	});
});

describe("type resolution", () => {
	it("preserves captured substitutions through a structured explicit argument", () => {
		expect.assertions(1);

		const source = parseCode(
			"type Identity<Value> = Value; type Outer<T> = Identity<Readonly<T>>; let value: Outer<unknown>;",
		);
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const outer = resolveTypeReference(createTypeResolution(findNthTypeReference(source, "Outer", 0)), environment);
		const identity = resolveNext(outer, environment);
		const wrapped = resolveNext(identity, environment);
		const unknown = resolveFirstTypeArgument(wrapped, environment);

		expect(unknown?.type.type).toBe("TSUnknownKeyword");
	});

	it("terminates a captured alias cycle", () => {
		expect.assertions(1);

		const source = parseCode("type Cycle = Cycle; let value: Cycle;");
		const environment = createTypeAliasEnvironment(getProgram(source), source.visitorKeys);
		const first = resolveTypeReference(createTypeResolution(findNthTypeReference(source, "Cycle", 1)), environment);

		expect(resolveNext(first, environment)).toBeUndefined();
	});
});

function getFirstTypeArgument(type: ESTree.TSType): ESTree.TSType | undefined {
	if (type.type !== "TSTypeReference") return undefined;
	return type.typeArguments?.params[0];
}

function resolveFirstTypeArgument(
	resolution: TypeResolution | undefined,
	environment: ReturnType<typeof createTypeAliasEnvironment>,
): TypeResolution | undefined {
	if (resolution === undefined) return undefined;
	const argument = getFirstTypeArgument(resolution.type);
	if (argument === undefined) return undefined;
	return resolveTypeReference(continueTypeResolution(resolution, argument), environment);
}

function resolveNext(
	resolution: TypeResolution | undefined,
	environment: ReturnType<typeof createTypeAliasEnvironment>,
): TypeResolution | undefined {
	return resolution === undefined ? undefined : resolveTypeReference(resolution, environment);
}

describe("createTypeAliasEnvironment", () => {
	it("returns the same immutable environment for repeated requests on one program", () => {
		expect.assertions(1);

		const source = parseCode("type Value = unknown;");
		const program = getProgram(source);
		const first = createTypeAliasEnvironment(program, source.visitorKeys);

		expect(createTypeAliasEnvironment(program, source.visitorKeys)).toBe(first);
	});

	it("caches separately by visitor-key identity for the same program", () => {
		expect.assertions(4);

		const source = parseCode("type Value = unknown;");
		const program = getProgram(source);
		const emptyVisitorKeys = {};
		const empty = createTypeAliasEnvironment(program, emptyVisitorKeys);
		const complete = createTypeAliasEnvironment(program, source.visitorKeys);

		expect(empty).not.toBe(complete);
		expect(empty.aliases).toStrictEqual([]);
		expect(complete.aliases.map((alias) => alias.id.name)).toStrictEqual(["Value"]);
		expect(createTypeAliasEnvironment(program, emptyVisitorKeys)).toBe(empty);
	});

	it("keeps names isolated across programs", () => {
		expect.assertions(3);

		const first = parseCode("type First = unknown;");
		const second = parseCode("type Second = unknown;");
		const firstEnvironment = createTypeAliasEnvironment(getProgram(first), first.visitorKeys);
		const secondEnvironment = createTypeAliasEnvironment(getProgram(second), second.visitorKeys);

		expect(firstEnvironment).not.toBe(secondEnvironment);
		expect(firstEnvironment.aliases.map((alias) => alias.id.name)).toStrictEqual(["First"]);
		expect(secondEnvironment.aliases.map((alias) => alias.id.name)).toStrictEqual(["Second"]);
	});
});
