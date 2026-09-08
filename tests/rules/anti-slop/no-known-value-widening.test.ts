import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-known-value-widening";
import { ts } from "$test/rule-testers";

const widening = { messageId: "widening" };

const prelude = "type Command = () => void;\nconst startCommand = () => {};";
function withPrelude(code: string): string {
	return `${prelude}\n${code}`;
}

describe("no-known-value-widening", () => {
	ts.run("no-known-value-widening", rule, {
		invalid: [
			{
				code: "const value: unknown = {};",
				errors: [{ messageId: "widening" }],
				documentation: { id: "fail", title: "known value annotated unknown" },
			},
			{ code: "const value: object = {};", errors: [widening] },
			{ code: "let value: unknown; value = {};", errors: [widening] },
			{ code: "let value: unknown; value = [1, 2];", errors: [widening] },
			{ code: "function create(): unknown { return {}; }", errors: [widening] },
			{ code: "function load(): object { return new Date(); }", errors: [widening] },
			{ code: "const load = (): unknown => `value`;", errors: [widening] },
			{ code: "const value: unknown = -1;", errors: [widening] },
			{ code: 'const value = <unknown>{ id: "one" };', errors: [widening] },
			{ code: 'const value = <object><unknown>{ id: "one" };', errors: 1 },
			{
				code: withPrelude("const commands: Record<string, Command> = { start: startCommand };"),
				errors: [widening],
			},
			{
				code: withPrelude("const commands: { [key: string]: Command } = { start: startCommand };"),
				errors: [widening],
			},
			{
				code: withPrelude("const commands: { [K in string]: Command } = { start: startCommand };"),
				errors: [widening],
			},
			{
				code: withPrelude("const commands: { start: Command } = { start: startCommand };"),
				errors: [widening],
			},
			{
				code: withPrelude(
					"const source = { start: startCommand }; const commands: Record<string, Command> = source;",
				),
				errors: [widening],
			},
			{
				code: withPrelude(
					"type Open = Record<string, Command>; const source = { start: startCommand }; const commands: Open = source;",
				),
				errors: [widening],
			},
			{
				code: withPrelude(
					"type Open = Readonly<Record<string, Command>>; const source = { start: startCommand }; const commands: Open = source;",
				),
				errors: [widening],
			},
			{
				code: withPrelude(
					"type Open = { [key: string]: Command }; const source = { start: startCommand }; const commands: Open = source;",
				),
				errors: [widening],
			},
			{
				code: withPrelude(
					"type Open = { [key in string]: Command }; const source = { start: startCommand }; const commands: Open = source;",
				),
				errors: [widening],
			},
			{
				code: withPrelude(
					"function outer() { type Open = Record<string, Command>; const commands: Open = { start: startCommand }; }",
				),
				errors: [widening],
			},
			{
				code: withPrelude(
					"type Index<T> = Record<string, T>; const commands: Index<Command> = { start: startCommand };",
				),
				errors: [widening],
			},
			{
				code: withPrelude(
					"type Index<T> = Record<string, T>; type CommandsByName = Index<Command>; const commands: CommandsByName = { start: startCommand };",
				),
				errors: [widening],
			},
			{
				code: withPrelude(
					"type Index<T = Command> = Record<string, T>; const commands: Index = { start: startCommand };",
				),
				errors: [widening],
			},
			{
				code: withPrelude(
					"type Identity<T> = T; const commands: Identity<Record<string, Command>> = { start: startCommand };",
				),
				errors: [widening],
			},
			{
				code: withPrelude("type Key = string; const commands: Record<Key, Command> = { start: startCommand };"),
				errors: [widening],
			},
			{
				code: withPrelude("const commands: Record<PropertyKey, Command> = { start: startCommand };"),
				errors: [widening],
			},
			{
				code: withPrelude("const commands: Record<string | 'start', Command> = { start: startCommand };"),
				errors: [widening],
			},
			{
				code: withPrelude("class Registry { commands: Record<string, Command> = { start: startCommand }; }"),
				errors: [widening],
			},
			{
				code: withPrelude(
					"class Registry { accessor commands: Record<string, Command> = { start: startCommand }; }",
				),
				errors: [
					{
						data: { subject: "property `commands`", target: "open dictionary" },
						messageId: "widening",
					},
				],
			},
			{
				code: withPrelude("let commands: Record<string, Command>; commands = { start: startCommand };"),
				errors: [widening],
			},
			{
				code: withPrelude("function create(): Record<string, Command> { return { start: startCommand }; }"),
				errors: [widening],
			},
			{
				code: withPrelude("function create(): { start: Command } { return { start: startCommand }; }"),
				errors: [widening],
			},
			{
				code: withPrelude("const commands = { start: startCommand } as Record<string, Command>;"),
				errors: [widening],
			},
			{
				code: withPrelude("const commands = ({ start: startCommand } as Record<string, Command>) as object;"),
				errors: 1,
			},
			{ code: 'const value = ({ id: "one" } as unknown)!;', errors: [widening] },
			{
				code: ['const source: string = "one";', "const widened: unknown = source;"].join("\n"),
				errors: [widening],
			},
			{ code: "const make = (): object => ({});", errors: [widening] },
			{ code: "const handlers = { onUpdate: (): object => ({}) };", errors: [widening] },
			{ code: "class Registry { create(): object { return {}; } }", errors: [widening] },
			{ code: 'class Registry { "create"(): object { return {}; } }', errors: [widening] },
			{ code: "class Registry { #create(): object { return {}; } }", errors: [widening] },
			{ code: 'class Registry { ["a" + "b"](): object { return {}; } }', errors: [widening] },
			{ code: "const make = (): object => { return {}; };", errors: [widening] },
			{ code: "class Registry { #make = (): object => ({}); }", errors: [widening] },
			{
				code: "const verify = function checked(): object { return {}; };",
				errors: [widening],
			},
			{ code: "const value: unknown = 1;", errors: [widening] },
			{ code: "const value: object = [];", errors: [widening] },
			{ code: "const source: unknown = {}; const value: unknown = source;", errors: 1 },
			{ code: "const source = {} as unknown; const value: unknown = source;", errors: 1 },
			{ code: "const value = (({} as unknown)! as object);", errors: 1 },
			{ code: "const other = (({} as unknown) satisfies unknown) as object;", errors: 1 },
			{
				code: "function isString(value: unknown): value is string { return true; } isString('known');",
				errors: [
					{
						data: {
							subject: "argument for parameter `value` of `isString`",
							target: "unknown",
						},
						messageId: "widening",
					},
				],
			},
			{
				code: [
					"function isString(value: unknown): value is string { return true; }",
					"const known = 'known';",
					"isString(known);",
				].join("\n"),
				errors: [widening],
			},
			{
				code: "function isString(value: string | unknown): value is string { return true; } isString('known');",
				errors: [widening],
			},
			{
				code: "function isString(value: unknown): value is string { return true; } function check(known: string): boolean { return isString(known); }",
				errors: [widening],
			},
			{
				code: "const isString = (value: unknown): value is string => true; const known: string = getValue(); isString(known);",
				errors: [widening],
			},
			{
				code: "type User = { readonly id: string }; function isUser(value: unknown): value is User { return true; } function parse(): User { return { id: 'known' }; } const user = parse(); isUser(user);",
				errors: [widening],
			},
			{
				code: "const guard = function(value: unknown): value is string { return true; }; guard('known');",
				errors: [widening],
			},
			{
				code: "const guard = function named(value: unknown): value is string { return true; }; guard('known');",
				errors: [widening],
			},
			{
				code: "(function(value: unknown): value is string { return true; })('known');",
				errors: [widening],
			},
			{
				code: "function guard(skip: boolean, value: unknown): value is string { return true; } guard(false, 'known');",
				errors: [
					{
						data: { subject: "argument for parameter `value` of `guard`", target: "unknown" },
						messageId: "widening",
					},
				],
			},
			{
				code: "function guard(this: unknown, value: unknown): value is string { return true; } guard('known');",
				errors: [
					{
						data: { subject: "argument for parameter `value` of `guard`", target: "unknown" },
						messageId: "widening",
					},
				],
			},
			{
				code: "function guard(value: unknown): value is string { return true; } const source = 'known'; const alias = source; guard(alias);",
				errors: [widening],
			},
			{
				code: "function guard(value: unknown): value is string { return true; } declare const input: unknown; guard(input as string);",
				errors: [widening],
			},
			{
				code: "function guard(value: unknown): value is string { return true; } declare const input: unknown; guard(<string>input);",
				errors: [widening],
			},
			{
				code: "function guard(value: unknown): value is string { return true; } declare const input: string; function read(): string { return input; } guard(read());",
				errors: [widening],
			},
			{
				code: "function guard(value: unknown): value is string { return true; } declare const input: string; const read = (): string => input; guard(read());",
				errors: [widening],
			},
			{
				code: "function guard(value: unknown): value is string { return true; } guard(('known' satisfies string));",
				errors: [widening],
			},
		],
		valid: [
			{
				code: [
					"type Command = () => void;",
					"const startCommand = () => {};",
					"const commands = { start: startCommand } satisfies Record<string, Command>;",
				].join("\n"),
				documentation: { id: "pass", title: "satisfies keeps the known keys" },
			},
			withPrelude("const commands: Record<string, Command> = {};"),
			withPrelude("type Index<T> = Record<string, T>; const commands: Index<Command> = {};"),
			withPrelude("class Registry { commands: Record<string, Command> = {}; }"),
			withPrelude("class Registry { accessor commands: Record<string, Command> = {}; }"),
			withPrelude("let commands: Record<string, Command>; commands = {};"),
			withPrelude("function create(): Record<string, Command> { return {}; }"),
			withPrelude("const create = (): Record<string, Command> => ({});"),
			withPrelude("const commands = {} as Record<string, Command>;"),
			withPrelude("const commands = <Record<string, Command>>{};"),
			withPrelude("const commands = { start: startCommand };"),
			withPrelude("const commands = { start: startCommand } as const;"),
			withPrelude("const commands = { start: startCommand } as const satisfies Record<string, Command>;"),
			withPrelude(
				"interface Commands { readonly start: Command } const commands: Commands = { start: startCommand };",
			),
			withPrelude(
				"type Commands = { readonly start: Command }; const commands: Commands = { start: startCommand };",
			),
			withPrelude(
				"type PermissionLevels = { readonly [Level in Permission]: number }; const levels: PermissionLevels = { admin: 1 };",
			),
			withPrelude(
				"type Diet = 'vegan' | 'omnivore'; const labels: Record<Diet, string> = { vegan: 'V', omnivore: 'O' };",
			),
			withPrelude(
				"type Diet = 'vegan' | 'omnivore'; type Labels = Record<Diet, string>; const labels: Labels = { vegan: 'V', omnivore: 'O' };",
			),
			withPrelude(
				"type Diet = 'vegan' | 'omnivore'; const labels: Readonly<Record<Diet, string>> = { vegan: 'V', omnivore: 'O' };",
			),
			withPrelude("const labels: Record<'a' | 'b', number> = { a: 1, b: 2 };"),
			withPrelude(
				"type Index<Key extends PropertyKey, Value> = Record<Key, Value>; const commands: Index<'start', Command> = { start: startCommand };",
			),
			withPrelude("function create() { return { start: startCommand }; }"),
			withPrelude(
				"interface Commands { readonly start: Command } function create(): Commands { return { start: startCommand }; }",
			),
			withPrelude(
				"declare function make(): Record<string, Command>; const commands: Record<string, Command> = make();",
			),
			withPrelude("declare const load: () => object; const value: unknown = load();"),
			withPrelude("import { Commands } from './types'; const commands: Commands = { start: startCommand };"),
			'let source = { id: "one" }; const value: unknown = source;',
			"value.prop = 1;",
			"leaked = 1;",
			"function assign(parameter: object) { parameter = {}; }",
			"function finish(): void { return; }",
			'const value: {} = "one";',
			"type A = B; type B = A; const value: A = {};",
			"function f(p: object) { const v: unknown = p; }",
			"const v: unknown = undefined;",
			"let total = 0; total += 1;",
			"class Owner { decorated; }",
			"const commands = ({}) as Record<string, Command>;",
			"const a = b; const b = a; const value: unknown = a;",
			"const value = (() => ({}))();",
			"type Index<T> = Record<string, T>; const empty: Index<Command> = {};",
			"function isString(value: unknown): value is string { return true; } declare const input: unknown; isString(input);",
			"function isString(value: string | unknown): value is string { return true; } declare const input: string | unknown; isString(input);",
			"function isString(value: unknown): value is string { return true; } declare function readInput(): unknown; isString(readInput());",
			"import { isString } from './guards'; isString('known');",
			"declare function isString(value: unknown): value is string; isString('known');",
			"declare const guards: { isString(value: unknown): value is string }; guards.isString('known');",
			"function inspect(value: unknown): boolean { return true; } inspect('known');",
			"function guard(this: unknown): this is string { return true; } guard();",
			"function guard(value: unknown): missing is string { return true; } guard('known');",
			"function guard(value): value is string { return true; } guard('known');",
			"function guard(value: string): value is string { return true; } guard('known');",
			"function guard(value: unknown): value is string { return true; } guard();",
			"function guard(value: unknown): value is string { return true; } declare const values: [string]; guard(...values);",
			"function guard(value: unknown): value is string { return true; } const first = second; const second = first; guard(first);",
			"function guard(value: unknown): value is string { return true; } const known = 'known'; known = read(); guard(known);",
			"function guard(value: unknown): value is string { return true; } declare const input: unknown; guard(input as unknown);",
			"function guard(value: unknown): value is string { return true; } declare const input: unknown; guard(<unknown>input);",
			"function guard(value: unknown): value is string { return true; } declare function read(): string; guard(read());",
			"function guard(value: unknown): value is string { return true; } declare const input: unknown; function read(): unknown { return input; } guard(read());",
			"function guard(value: unknown): value is string { return true; } declare const input: unknown; guard((input satisfies unknown));",
			"function guard(value: unknown): value is string { return true; } const notGuard = 1; notGuard('known');",
			"function guard(value: unknown): value is string { return true; } var known: string; var known: string; guard(known);",
			"function guard(value: unknown): value is string { return true; } function known() {} guard(known);",
			"function guard(value: unknown): value is string { return true; } try {} catch (error) { guard(error); }",
			"function guard(value: unknown): value is string { return true; } function check({ known }: { known: string }) { guard(known); }",
			withPrelude("class Registry { accessor commands: Record<string, Command>; }"),
			"const guard: (value: string) => boolean = (value: unknown): value is string => true; guard('known');",
			"function source() {} const value: unknown = source;",
			"let guard; guard('known');",
		],
	});
});
