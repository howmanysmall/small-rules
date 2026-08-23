import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-unknown-returns";
import { ts } from "$test/rule-testers";

const unknownReturn = { messageId: "unknownReturn" };

describe("no-unknown-returns", () => {
	ts.run("no-unknown-returns", rule, {
		invalid: [
			{
				code: "function load(): unknown { return input; }",
				errors: [{ messageId: "unknownReturn" }],
				documentation: { id: "fail", title: "unknown return contract" },
			},
			{ code: "const load = (): unknown => input;", errors: [unknownReturn] },
			{ code: "type Loader = () => unknown;", errors: [unknownReturn] },
			{ code: "function load(): Promise<unknown> { return promise; }", errors: [unknownReturn] },
			{ code: "function load(): PromiseLike<unknown> { return input; }", errors: [unknownReturn] },
			{ code: "function load(): (unknown) { return input; }", errors: [unknownReturn] },
			{ code: "function load(): unknown | string { return input; }", errors: [unknownReturn] },
			{ code: "interface Loader { load(): unknown }", errors: [unknownReturn] },
			{ code: "declare function load(): unknown;", errors: [unknownReturn] },
			{
				code: "type UnknownValue = unknown; function load(): UnknownValue { return input; }",
				errors: [unknownReturn],
			},
			{
				code: "type Item = unknown; type Fallback<Input> = Input extends infer Item ? string : () => Item;",
				errors: [unknownReturn],
			},
		],
		valid: [
			{
				code: "function load(): User { return user; }",
				documentation: { id: "pass", title: "named domain return" },
			},
			"function generic<Value>(): Value { return value; }",
			"function cause(): { cause: unknown } { return { cause: input }; }",
			"type Result = { value: unknown }; type Wrapper = { result: Result }; function load(): Wrapper { return wrapper; }",
			"function parse(): ImportedValue { return input; }",
			"declare function make(): Record<string, Command>; function use(value: Record<string, Command>) {}",
			"function load(): Promise<string> { return promise; }",
			"function load(): PromiseLike { return input; }",
			[
				"export default class Registry {}",
				"export {};",
				"export type Exported = string;",
				"type Internal = Exported;",
				"function load(value: Internal): Internal { return value; }",
			].join("\n"),
			"declare namespace NS { export type Payload = string } function load(): NS.Payload { return value; }",
			"declare namespace NS { type Payload = string } function load(): NS.Payload { return value; }",
			"function load() { return input; }",
		],
	});
});
