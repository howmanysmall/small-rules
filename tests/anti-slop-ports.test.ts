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

describe("anti-slop ports", () => {
	ts.run("no-known-value-widening", noKnownValueWidening, {
		invalid: [
			{
				code: "const value: unknown = {};",
				errors: [{ messageId: "widening" }],
				documentation: { id: "fail", title: "known object widened to unknown" },
			},
			{ code: "const value: object = [];", errors: [{ messageId: "widening" }] },
			{ code: "let value: unknown; value = {};", errors: [{ messageId: "widening" }] },
			{ code: "function create(): unknown { return {}; }", errors: [{ messageId: "widening" }] },
			{
				code: "type Command = () => void; const startCommand = () => {}; const commands: Record<string, Command> = { start: startCommand };",
				errors: [{ messageId: "widening" }],
			},
			{
				code: "type Command = () => void; const startCommand = () => {}; type Open = Record<string, Command>; const source = { start: startCommand }; const commands: Open = source;",
				errors: [{ messageId: "widening" }],
			},
			{
				code: "type Command = () => void; const startCommand = () => {}; const commands = { start: startCommand } as Record<string, Command>;",
				errors: [{ messageId: "widening" }],
			},
		],
		valid: [
			{
				code: [
					"type Command = () => void;",
					"const startCommand = () => {};",
					"const commands = { start: startCommand } satisfies Record<string, Command>;",
				].join("\n"),
				documentation: { id: "pass", title: "satisfies preserves known keys" },
			},
			"type Command = () => void; const startCommand = () => {}; const commands: Record<string, Command> = {};",
			"declare const input: unknown; const parsed = input as { readonly id: string };",
		],
	});

	ts.run("no-module-mocking", noModuleMocking, {
		invalid: [
			{
				code: "vi.mock('./user-store');",
				errors: [{ messageId: "moduleMock" }],
				documentation: { id: "fail", title: "Vitest module mock" },
			},
			{ code: "jest.mock('./user-store');", errors: [{ messageId: "moduleMock" }] },
			{ code: "vi['doMock']('./user-store');", errors: [{ messageId: "moduleMock" }] },
			{ code: "jest.unstable_mockModule('./user-store');", errors: [{ messageId: "moduleMock" }] },
			{ code: "import { vi } from 'vitest'; vi.mock('./user-store');", errors: [{ messageId: "moduleMock" }] },
			{
				code: "import { jest } from '@jest/globals'; jest.mock('./user-store');",
				errors: [{ messageId: "moduleMock" }],
			},
		],
		valid: [
			{
				code: "const store = new InMemoryUserStore();",
				documentation: { id: "pass", title: "real test implementation" },
			},
			"vi.spyOn(store, 'save');",
			"const vi = { mock() {} }; vi.mock();",
			"function test(jest: { mock(): void }) { jest.mock(); }",
		],
	});

	ts.run("no-object-parameters", noObjectParameters, {
		invalid: [
			{
				code: "function save(value: object) {}",
				errors: [{ messageId: "objectParameter" }],
				documentation: { id: "fail", title: "broad object parameter" },
			},
			{ code: "type Alias = object; function f(value: Alias) {}", errors: [{ messageId: "objectParameter" }] },
			{ code: "type Alias = (object); function f(value: Alias) {}", errors: [{ messageId: "objectParameter" }] },
			{
				code: "type Item = object; type Fallback<Input> = Input extends infer Item ? string : (value: Item) => void;",
				errors: [{ messageId: "objectParameter" }],
			},
		],
		valid: [
			{
				code: ["interface Owner { readonly id: string }", "function save(value: Owner) {}"].join("\n"),
				documentation: { id: "pass", title: "named owner contract" },
			},
			"function f<Value>(value: Value) {}",
			"type Alias = object; function consume<Alias>(value: Alias) {}",
		],
	});

	ts.run("no-reflect-apply", noReflectApply, {
		invalid: [
			{
				code: "const value = Reflect.apply(operation, owner, args);",
				errors: [{ messageId: "reflectApply" }],
				documentation: { id: "fail", title: "Reflect apply" },
			},
			{ code: "Reflect['apply'](operation, owner, args);", errors: [{ messageId: "reflectApply" }] },
		],
		valid: [
			{
				code: "const value = operation.apply(owner, args);",
				documentation: { id: "pass", title: "direct function call" },
			},
			"const Reflect = { apply() { return 1; } }; Reflect.apply();",
		],
	});

	ts.run("no-reflect-get", noReflectGet, {
		invalid: [
			{
				code: "const value = Reflect.get(owner, key);",
				errors: [{ messageId: "reflectGet" }],
				documentation: { id: "fail", title: "Reflect get" },
			},
			{ code: "Reflect['get'](owner, key);", errors: [{ messageId: "reflectGet" }] },
		],
		valid: [
			{
				code: "const value = owner[key];",
				documentation: { id: "pass", title: "typed property access" },
			},
			"const Reflect = { get() { return 1; } }; Reflect.get();",
		],
	});

	ts.run("no-runtime-typeof", noRuntimeTypeof, {
		invalid: [
			{
				code: "if (typeof input === 'string') use(input);",
				errors: [{ messageId: "runtimeTypeof" }],
				documentation: { id: "fail", title: "ad hoc typeof narrowing" },
			},
			{
				code: "function isString(value: unknown): value is string { return typeof value === 'string'; }",
				errors: [{ messageId: "runtimeTypeof" }],
			},
		],
		valid: [
			{
				code: "function isString(value: unknown): value is string { return typeof value === 'string'; }",
				options: [{ allowInTypeGuards: true }],
				documentation: { id: "pass", title: "explicit type-guard exception" },
			},
			"const value = input;",
		],
	});

	tsx.run("no-shape-in-symbol-names", noShapeInSymbolNames, {
		invalid: [
			{
				code: "interface UserShape { id: string }",
				errors: [{ messageId: "forbiddenSymbolName" }],
				documentation: { id: "fail", title: "shape in TypeScript symbol" },
			},
			{ code: "class ShapeFactory {}", errors: [{ messageId: "forbiddenSymbolName" }] },
			{ code: "class X { #shapeCache = 1; }", errors: [{ messageId: "forbiddenSymbolName" }] },
			{ code: "const view = <Shape />;", errors: [{ messageId: "forbiddenSymbolName" }] },
		],
		valid: [
			{
				code: "interface User { id: string }",
				documentation: { id: "pass", title: "domain-named symbol" },
			},
			"const userFactory = createUser;",
		],
	});

	ts.run("no-unknown-parameters", noUnknownParameters, {
		invalid: [
			{
				code: "function handle(input: unknown) {}",
				errors: [{ messageId: "unknownParameter" }],
				documentation: { id: "fail", title: "unknown function parameter" },
			},
			{ code: "const handle = (input: unknown) => {};", errors: [{ messageId: "unknownParameter" }] },
			{ code: "type Handler = (input: unknown) => void;", errors: [{ messageId: "unknownParameter" }] },
		],
		valid: [
			{
				code: "function enrich(cause: unknown) {}",
				documentation: { id: "pass", title: "error cause exception" },
			},
			"function handle(input: User) {}",
		],
	});

	ts.run("no-unknown-returns", noUnknownReturns, {
		invalid: [
			{
				code: "function load(): unknown { return input; }",
				errors: [{ messageId: "unknownReturn" }],
				documentation: { id: "fail", title: "unknown return contract" },
			},
			{ code: "const load = (): unknown => input;", errors: [{ messageId: "unknownReturn" }] },
			{ code: "type Loader = () => unknown;", errors: [{ messageId: "unknownReturn" }] },
			{ code: "function load(): Promise<unknown> { return promise; }", errors: [{ messageId: "unknownReturn" }] },
			{
				code: "type UnknownValue = unknown; function load(): UnknownValue { return input; }",
				errors: [{ messageId: "unknownReturn" }],
			},
		],
		valid: [
			{
				code: "function load(): User { return user; }",
				documentation: { id: "pass", title: "named domain return" },
			},
			"function generic<Value>(): Value { return value; }",
			"function cause(): { cause: unknown } { return { cause: input }; }",
		],
	});

	ts.run("no-unknown-type-aliases", noUnknownTypeAliases, {
		invalid: [
			{
				code: "type ExternalValue = unknown;",
				errors: [{ messageId: "unknownAlias" }],
				documentation: { id: "fail", title: "unknown type alias" },
			},
			{
				code: "type UnknownValue = unknown; type Alias = UnknownValue;",
				errors: [{ messageId: "unknownAlias" }, { messageId: "unknownAlias" }],
			},
		],
		valid: [
			{
				code: "type User = { readonly id: string };",
				documentation: { id: "pass", title: "specific type alias" },
			},
			"type Alias = string; type UserId = Alias;",
		],
	});

	ts.run("no-unsafe-dictionary-type", noUnsafeDictionaryType, {
		invalid: [
			{
				code: "type Metadata = Record<string, unknown>;",
				errors: [{ messageId: "unsafeDictionary" }],
				documentation: { id: "fail", title: "unknown dictionary values" },
			},
			{ code: "type Metadata = { [key: string]: any };", errors: [{ messageId: "unsafeDictionary" }] },
			{ code: "type Metadata = Record<string, {}>;", errors: [{ messageId: "unsafeDictionary" }] },
			{
				code: "type Escape = unknown; type Metadata = Record<string, Escape>;",
				errors: [{ messageId: "unsafeDictionary" }],
			},
			{
				code: "interface Escape {} type Metadata = Record<string, Escape>;",
				errors: [{ messageId: "unsafeDictionary" }],
			},
		],
		valid: [
			{
				code: "type Commands = Record<string, Command>;",
				documentation: { id: "pass", title: "concrete dictionary values" },
			},
			"type Allowed = Record<string, { payload: unknown }>;",
			"interface Owner { readonly id: string } type Metadata = Record<string, unknown & Owner>;",
		],
	});

	ts.run("no-widen-then-assert", noWidenThenAssert, {
		invalid: [
			{
				code: [
					"const source = { id: 'second' };",
					"const widened: unknown = source;",
					"const parsed = widened as { readonly id: string };",
				].join("\n"),
				errors: [{ messageId: "widenThenAssert" }],
				documentation: { id: "fail", title: "widened binding asserted back" },
			},
		],
		valid: [
			{
				code: ["const source = { id: 'first' };", "const widened: unknown = source;"].join("\n"),
				documentation: { id: "pass", title: "widening without an assertion" },
			},
			"declare const input: unknown; const parsed = input as { readonly id: string };",
		],
	});

	ts.run("require-safety-comment-for-type-assertion", requireSafetyCommentForTypeAssertion, {
		invalid: [
			{
				code: "const userId = value as UserId;",
				errors: [{ messageId: "missingSafetyComment" }],
				documentation: { id: "fail", title: "unexplained type assertion" },
			},
			{ code: "const userId = <UserId>value;", errors: [{ messageId: "missingSafetyComment" }] },
			{
				code: "const userId = value as UserId; // SAFETY: Too late.",
				errors: [{ messageId: "missingSafetyComment" }],
			},
		],
		valid: [
			{
				code: "// SAFETY: parseUserId validated the identifier before branding it.\nconst userId = value as UserId;",
				documentation: { id: "pass", title: "assertion with checked invariant" },
			},
			"const values = [1, 2] as const;",
			"const userId = /* SAFETY: Parser established the identifier invariant. */ value as UserId;",
		],
	});
});
