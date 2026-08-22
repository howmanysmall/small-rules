import { describe } from "vitest";

import noKnownValueWidening from "$oxc-rules/anti-slop/no-known-value-widening";
import noModuleMocking from "$oxc-rules/anti-slop/no-module-mocking";
import noObjectParameters from "$oxc-rules/anti-slop/no-object-parameters";
import noReflectApply from "$oxc-rules/anti-slop/no-reflect-apply";
import noReflectGet from "$oxc-rules/anti-slop/no-reflect-get";
import noRuntimeTypeof from "$oxc-rules/anti-slop/no-runtime-typeof";
import noShapeInSymbolNames from "$oxc-rules/anti-slop/no-shape-in-symbol-names";
import noUnknownParameters from "$oxc-rules/anti-slop/no-unknown-parameters";
import noUnknownReturns from "$oxc-rules/anti-slop/no-unknown-returns";
import noUnknownTypeAliases from "$oxc-rules/anti-slop/no-unknown-type-aliases";
import noUnsafeDictionaryType from "$oxc-rules/anti-slop/no-unsafe-dictionary-type";
import noWidenThenAssert from "$oxc-rules/anti-slop/no-widen-then-assert";
import requireSafetyCommentForTypeAssertion from "$oxc-rules/anti-slop/require-safety-comment-for-type-assertion";

import { ts, tsx } from "./rule-testers";

const objectParameter = { messageId: "objectParameter" };
const unknownParameter = { messageId: "unknownParameter" };
const unknownReturn = { messageId: "unknownReturn" };
const unsafeDictionary = { messageId: "unsafeDictionary" };
const widening = { messageId: "widening" };
const widenThenAssert = { messageId: "widenThenAssert" };

describe("anti-slop coverage", () => {
	describe("no-object-parameters", () => {
		ts.run("no-object-parameters coverage", noObjectParameters, {
			invalid: [
				{ code: "type Alias = object; function save(value: Alias) {}", errors: [objectParameter] },
				{ code: "type Alias = object; function save(value: Alias | string) {}", errors: [objectParameter] },
				{ code: "function save(value: (object)) {}", errors: [objectParameter] },
				{ code: "function save(...values: object) {}", errors: [objectParameter] },
				{ code: "type Handler = (value: object) => void;", errors: [objectParameter] },
				{ code: "interface Handler { save(value: object): void }", errors: [objectParameter] },
				{ code: "function save({ id }: object) {}", errors: [objectParameter] },
				{ code: "export type Alias = object; function save(value: Alias) {}", errors: [objectParameter] },
				{ code: "class Owner { constructor(private readonly value: object) {} }", errors: [objectParameter] },
				{ code: "function save(value: object = {}) {}", errors: [objectParameter] },
				{ code: "function save({ id }: object = {}) {}", errors: [objectParameter] },
			],
			valid: [
				"type Alias = object; function save<Alias>(value: Alias) {}",
				"type Alias = object; type Handler<Value> = Value extends infer Alias ? (value: Alias) => void : never;",
				"type Alias = object; type Handlers<Key extends string> = { [Alias in Key]: (value: Alias) => void };",
				"type Alias<T> = object; function save(value: Alias<string>) {}",
				"type First = Second; type Second = First; function save(value: First) {}",
				"function save(...values) {}",
				"function save(value = {}) {}",
			],
		});
	});

	describe("no-unknown-parameters", () => {
		ts.run("no-unknown-parameters coverage", noUnknownParameters, {
			invalid: [
				{ code: "function save(value: unknown = input) {}", errors: [unknownParameter] },
				{ code: "function save(...values: unknown) {}", errors: [unknownParameter] },
				{ code: "type Handler = (value: unknown) => void;", errors: [unknownParameter] },
				{ code: "interface Handler { save(value: unknown): void }", errors: [unknownParameter] },
				{ code: "declare function save(value: unknown): void;", errors: [unknownParameter] },
				{ code: "function save({ id }: unknown) {}", errors: [unknownParameter] },
			],
			valid: [
				"function save(cause: unknown = input) {}",
				"function save(...cause: unknown[]) {}",
				"type Constructor = new (cause: unknown) => Error;",
				"class Owner { constructor(public cause: unknown) {} }",
				"function save(...values) {}",
			],
		});
	});

	describe("no-unknown-returns", () => {
		ts.run("no-unknown-returns coverage", noUnknownReturns, {
			invalid: [
				{ code: "function load(): (unknown) { return input; }", errors: [unknownReturn] },
				{ code: "function load(): unknown | string { return input; }", errors: [unknownReturn] },
				{ code: "function load(): PromiseLike<unknown> { return input; }", errors: [unknownReturn] },
				{
					code: "type Payload = unknown; type Result = Payload; function load(): Result { return input; }",
					errors: [unknownReturn],
				},
				{ code: "interface Loader { load(): unknown }", errors: [unknownReturn] },
				{ code: "type Loader = () => Promise<unknown>;", errors: [unknownReturn] },
				{
					code: "export type Result = unknown; function load(): Result { return input; }",
					errors: [unknownReturn],
				},
			],
			valid: [
				"type Result = unknown; function load<Result>(): Result { return value; }",
				"type Result = unknown; type Factory<Value> = Value extends Promise<infer Result> ? () => Result : never;",
				"type Result = unknown; type Factories<Key extends string> = { [Result in Key]: () => Result };",
				"type First = Second; type Second = First; function load(): First { return value; }",
				"function load(): Promise<string> { return promise; }",
				"declare namespace NS { type Payload = string } function load(): NS.Payload { return value; }",
				"function load(): Promise { return input; }",
				"type Box<Value> = { value: Value }; function load(): Box<string> { return box; }",
				"function load() { return input; }",
			],
		});
	});

	describe("no-unknown-type-aliases", () => {
		ts.run("no-unknown-type-aliases coverage", noUnknownTypeAliases, {
			invalid: [
				{ code: "type Payload = (unknown);", errors: [{ messageId: "unknownAlias" }] },
				{
					code: "type Payload = unknown; export type ExternalPayload = Payload;",
					errors: [{ messageId: "unknownAlias" }, { messageId: "unknownAlias" }],
				},
				{ code: "type Box<Value> = unknown;", errors: [{ messageId: "unknownAlias" }] },
			],
			valid: [
				"type Payload = Promise<unknown>;",
				"type Payload<Value> = Value; type ExternalPayload = Payload<unknown>;",
				"type First = Second; type Second = First;",
			],
		});
	});

	describe("no-unsafe-dictionary-type", () => {
		ts.run("no-unsafe-dictionary-type coverage", noUnsafeDictionaryType, {
			invalid: [
				{ code: "type Metadata = { readonly [key: string]: unknown };", errors: [unsafeDictionary] },
				{ code: "type Metadata = { [Key in string]: object };", errors: [unsafeDictionary] },
				{ code: "interface Metadata { [key: string]: any }", errors: [unsafeDictionary] },
				{
					code: "type Dangerous = { [key: string]: unknown }; type Metadata = Dangerous;",
					errors: [unsafeDictionary, unsafeDictionary],
				},
				{ code: "interface Escape {} type Metadata = Record<string, Escape>;", errors: [unsafeDictionary] },
				{ code: "type Metadata = Readonly<Record<string, unknown>>;", errors: [unsafeDictionary] },
				{ code: "type Metadata = Record<string, unknown | string>;", errors: [unsafeDictionary] },
				{ code: "type Metadata = Record<string, unknown & object>;", errors: [unsafeDictionary] },
				{ code: "type Metadata = Record<string, unknown & any>;", errors: [unsafeDictionary] },
				{ code: "type Metadata = Record<string, readonly unknown>;", errors: [unsafeDictionary] },
			],
			valid: [
				"interface Owner { readonly id: string } type Metadata = Record<string, unknown & Owner>;",
				"interface Owner { readonly id: string } interface Metadata { [key: string]: Owner }",
				"interface Owner { readonly id: string } type Metadata = Readonly<Record<string, Owner>>;",
				"interface Escape { readonly id: string } type Metadata = Record<string, Escape>;",
				"interface Escape {} interface Escape { readonly id: string } type Metadata = Record<string, Escape>;",
				'import { Record } from "./owner"; type Metadata = Record<string, unknown>;',
				"type Record<Key, Value> = { key: Key; value: Value }; type Metadata = Record<string, unknown>;",
				"type Metadata = { [key: string]: Partial };",
				"type Metadata = Record;",
				"interface Owner { readonly id: string } type Metadata = Record<string, Owner | string>;",
				"type Metadata = { [Key in string] };",
				"type Values = readonly string[]; type Metadata = Values;",
			],
		});
	});

	describe("no-module-mocking", () => {
		ts.run("no-module-mocking coverage", noModuleMocking, {
			invalid: [
				{ code: 'vi.doMock("./owner");', errors: [{ messageId: "moduleMock" }] },
				{ code: 'jest["mock"]("./owner");', errors: [{ messageId: "moduleMock" }] },
				{
					code: 'import { "vi" as framework } from "vitest"; framework.mock("./owner");',
					errors: [{ messageId: "moduleMock" }],
				},
				{
					code: 'import { vi as testFramework } from "vitest"; testFramework.mock("./owner");',
					errors: [{ messageId: "moduleMock" }],
				},
				{
					code: 'import { jest as testFramework } from "@jest/globals"; testFramework.unstable_mockModule("./owner");',
					errors: [{ messageId: "moduleMock" }],
				},
			],
			valid: [
				"const vi = { mock() {} }; vi.mock();",
				"function configure(vi: { mock(): void }) { vi.mock(); }",
				"const { jest } = frameworks; jest.mock();",
				'vi[method]("./owner");',
				"jest.resetModules();",
				'import vi from "vitest"; vi.mock("./owner");',
				'import * as vitest from "vitest"; vitest.mock("./owner");',
				'createFramework().mock("./owner");',
				'anything.mock("./owner");',
				'mockDirectly("./owner");',
				"class Child extends Parent { constructor() { super(); } }",
			],
		});
	});

	describe("no-reflect-apply", () => {
		ts.run("no-reflect-apply coverage", noReflectApply, {
			invalid: [
				{ code: "Reflect.apply(operation, owner, arguments);", errors: [{ messageId: "reflectApply" }] },
				{ code: 'Reflect["apply"](operation, owner, arguments);', errors: [{ messageId: "reflectApply" }] },
			],
			valid: [
				"function invoke(Reflect: { apply(): void }) { Reflect.apply(); }",
				'import { Reflect } from "./owner"; Reflect.apply();',
				"Reflect[method](operation, owner, arguments);",
				"Reflect.call(operation, owner, arguments);",
				"invokeWith(operation, owner, arguments);",
				"class Child extends Parent { constructor() { super(); } }",
			],
		});
	});

	describe("no-reflect-get", () => {
		ts.run("no-reflect-get coverage", noReflectGet, {
			invalid: [
				{ code: "Reflect.get(owner, key);", errors: [{ messageId: "reflectGet" }] },
				{ code: 'Reflect["get"](owner, key);', errors: [{ messageId: "reflectGet" }] },
			],
			valid: [
				"function read(Reflect: { get(): void }) { Reflect.get(); }",
				'import { Reflect } from "./owner"; Reflect.get();',
				"Reflect[method](owner, key);",
				"Reflect.has(owner, key);",
				"apply(owner, key);",
				"class Child extends Parent { constructor() { super(); } }",
			],
		});
	});

	describe("no-runtime-typeof", () => {
		ts.run("no-runtime-typeof coverage", noRuntimeTypeof, {
			invalid: [
				{
					code: 'function isText(value: unknown): value is string { return typeof value === "string"; }',
					errors: [{ messageId: "runtimeTypeof" }],
				},
				{
					code: 'function isText(value: unknown): value is string { return (() => typeof value === "string")(); }',
					options: [{ allowInTypeGuards: true }],
					errors: [{ messageId: "runtimeTypeof" }],
				},
				{ code: "const type = typeof value;", options: [{}], errors: [{ messageId: "runtimeTypeof" }] },
				{
					code: "const kind = typeof value;",
					options: [{ allowInTypeGuards: true }],
					errors: [{ messageId: "runtimeTypeof" }],
				},
			],
			valid: [
				{
					code: 'const isText = (value: unknown): value is string => typeof value === "string";',
					options: [{ allowInTypeGuards: true }],
				},
				{
					code: 'function assertText(value: unknown): asserts value is string { if (typeof value !== "string") throw new Error(); }',
					options: [{ allowInTypeGuards: true }],
				},
			],
		});
	});

	describe("no-shape-in-symbol-names", () => {
		tsx.run("no-shape-in-symbol-names coverage", noShapeInSymbolNames, {
			invalid: [
				{ code: "interface SHAPEModel { id: string }", errors: [{ messageId: "forbiddenSymbolName" }] },
				{ code: "class Owner { #shapeCache = 1; }", errors: [{ messageId: "forbiddenSymbolName" }] },
				{ code: "const view = <ShapePanel />;", errors: [{ messageId: "forbiddenSymbolName" }] },
			],
			valid: ["const owner = <OwnerPanel />;", "interface DomainModel { id: string }"],
		});
	});

	describe("no-known-value-widening", () => {
		ts.run("no-known-value-widening coverage", noKnownValueWidening, {
			invalid: [
				{ code: 'const value: { readonly id: string } = { id: "one" };', errors: [widening] },
				{ code: "const value: { [key: string]: number } = { first: 1 };", errors: [widening] },
				{ code: "const value: { [Key in string]: number } = { first: 1 };", errors: [widening] },
				{ code: 'type Box<Value> = Value; const value: Box<string> = "one";', errors: [widening] },
				{ code: 'const source = { id: "one" }; const value: unknown = source;', errors: [widening] },
				{ code: "let value: unknown; value = [1, 2];", errors: [widening] },
				{ code: "function load(): object { return new Date(); }", errors: [widening] },
				{ code: "const load = (): unknown => `value`;", errors: [widening] },
				{ code: 'const value = <unknown>{ id: "one" };', errors: [widening] },
				{ code: 'const value = ({ id: "one" } as unknown)!;', errors: [widening] },
				{ code: 'const value: unknown = (({ id: "one" } satisfies { id: string }));', errors: [widening] },
				{ code: "const value: unknown = function () {};", errors: [widening] },
				{ code: "const value: unknown = class {};", errors: [widening] },
				{ code: "const value: unknown = -1;", errors: [widening] },
			],
			valid: [
				"const value: { [key: string]: number } = {};",
				"type Box<Value> = Value; const value: Box<string> = {};",
				'let source = { id: "one" }; const value: unknown = source;',
				"declare const load: () => object; const value: unknown = load();",
				'const value = ({ id: "one" } as unknown) as User;',
				"value.prop = 1;",
				"leaked = 1;",
				"function assign(parameter: object) { parameter = {}; }",
				"function finish(): void { return; }",
				"const [first] = values;",
				'const value: {} = "one";',
				"type A = B; type B = A; const value: A = {};",
			],
		});
	});

	describe("no-widen-then-assert", () => {
		ts.run("no-widen-then-assert coverage", noWidenThenAssert, {
			invalid: [
				{
					code: 'const source = { id: "one" }; const widened: unknown = source; const parsed = widened as { readonly id: string };',
					errors: [widenThenAssert],
				},
				{
					code: "const source = [1, 2]; const widened: any = source; const parsed = widened as number[];",
					errors: [widenThenAssert],
				},
				{
					code: 'const source = { id: "one" }; const widened: object = source; const parsed = widened as { readonly id: string };',
					errors: [widenThenAssert],
				},
				{
					code: 'const source = { id: "one" }; const widened: Record<string, unknown> = source; const parsed = widened as { readonly id: string };',
					errors: [widenThenAssert],
				},
				{
					code: 'const source = { id: "one" }; const widened: unknown = source; const parsed = <{ readonly id: string }>widened;',
					errors: [widenThenAssert],
				},
				{
					code: 'const source = { id: "one" }; const widened: unknown = source; const parsed = (widened) as { readonly id: string };',
					errors: [widenThenAssert],
				},
				{
					code: 'const source = { id: "one" }; const first: unknown = source; const widened: unknown = first; const parsed = widened as { readonly id: string };',
					errors: [widenThenAssert],
				},
				{
					code: "const source = `one`; const widened: (unknown) = source; const parsed = widened as ({ readonly id: string });",
					errors: [widenThenAssert],
				},
				{
					code: "declare const input: unknown; const source = input as { readonly id: string }; const widened: unknown = source; const parsed = widened as { readonly id: string };",
					errors: [widenThenAssert],
				},
				{
					code: "declare const input: unknown; const source = <{ readonly id: string }>input; const widened: unknown = source; const parsed = widened as { readonly id: string };",
					errors: [widenThenAssert],
				},
			],
			valid: [
				'let widened: unknown = { id: "one" }; const parsed = widened as { readonly id: string };',
				"declare const input: unknown; const widened: unknown = input; const parsed = widened as { readonly id: string };",
				'const source = { id: "one" }; const widened: unknown = source; const parsed = widened as object;',
				'type Open = Record<string, unknown>; const source = { id: "one" }; const widened: Open = source; const parsed = widened as { readonly id: string };',
				'const source = { id: "one" }; const widened = source; const parsed = widened as { readonly id: string };',
				"const parsed = source.id as { readonly id: string };",
				"const parsed = undeclared as { readonly id: string };",
				"function read(widened: unknown) { const parsed = widened as { readonly id: string }; }",
				"const [first] = [1, 2]; const widened: unknown = first; const parsed = widened as number[];",
				"const source = getValue(); const widened: unknown = source; const parsed = widened as { readonly id: string };",
				'const source = { id: "one" }; const widened: Record<string, string> = source; const parsed = widened as { readonly id: string };',
				"const source = {}; const widened: Record<string> = source; const parsed = widened as { readonly id: string };",
			],
		});
	});

	describe("require-safety-comment-for-type-assertion", () => {
		ts.run("require-safety-comment-for-type-assertion coverage", requireSafetyCommentForTypeAssertion, {
			invalid: [
				{ code: "const user = value as User;", errors: [{ messageId: "missingSafetyComment" }] },
				{
					code: "const user = value as User; // SAFETY: too late",
					errors: [{ messageId: "missingSafetyComment" }],
				},
				{ code: "function load() { return value as User; }", errors: [{ messageId: "missingSafetyComment" }] },
			],
			valid: [
				"const values = [1, 2] as const;",
				"// SAFETY: The parser validated this value.\nconst user = value as User;",
				"// SAFETY: The parser validated this value.\nconsume(value as User);",
				"class Owner { // SAFETY: Construction validated this value.\nuser = value as User; }",
				"function load() { // SAFETY: The parser validated this value.\nreturn value as User; }",
				"// SAFETY: This error has a verified owner.\nthrow value as Error;",
			],
		});
	});
});
