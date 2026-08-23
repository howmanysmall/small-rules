import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-known-value-widening";
import { ts } from "$test/rule-testers";

const widening = { messageId: "widening" };

const prelude = "type Command = () => void;\nconst startCommand = () => {};";
const withPrelude = (code: string): string => `${prelude}\n${code}`;

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
				code: withPrelude("class Registry { commands: Record<string, Command> = { start: startCommand }; }"),
				errors: [widening],
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
		],
	});
});
