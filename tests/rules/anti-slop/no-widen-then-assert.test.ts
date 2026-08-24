import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-widen-then-assert";
import { ts } from "$test/rule-testers";

const widenThenAssert = { messageId: "widenThenAssert" };

describe("no-widen-then-assert", () => {
	ts.run("no-widen-then-assert", rule, {
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
			{
				code: [
					"const source = { id: 'one' };",
					"const widened = source as unknown;",
					"const parsed = widened as { readonly id: string };",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const source = { id: 'one' };",
					"const widened: unknown = source;",
					"const parsed = (widened) as { readonly id: string };",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					'const source = { id: "x" };',
					"const widened: unknown = source;",
					"const restored = widened as { id: string };",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const text = `value`;",
					"const widened: unknown = text;",
					"const parsed = widened as string;",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const source = {};",
					"const widened: Record<string | number, unknown> = source;",
					"const parsed = widened as Record<number, string>;",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const source = {};",
					"const widened: Record<PropertyKey, unknown> = source;",
					"const parsed = widened as Record<string, number>;",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const source = {};",
					"const widened: Record<symbol, unknown> = source;",
					"const parsed = widened as Record<symbol, string>;",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const widened: { [key: string]: unknown } = {};",
					"const parsed = widened as { readonly id: string };",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const widened: Readonly<Record<string, unknown>> = {};",
					"const parsed = widened as Record<string, number>;",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"function read() {",
					"\tconst source = { id: 'one' };",
					"\tconst widened: object = source;",
					"\tconst parsed = widened as { readonly id: string };",
					"\treturn parsed;",
					"}",
				].join("\n"),
				errors: [widenThenAssert],
			},
			// Object-widened bindings assert through every definitely-object shape.
			{
				code: [
					"const pair = ['a', 1];",
					"const widened: object = pair;",
					"const parsed = widened as [string, number];",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const factory = () => 1;",
					"const widened: object = factory;",
					"const parsed = widened as () => number;",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"class Ctor {}",
					"const made = new Ctor();",
					"const widened: object = made;",
					"const parsed = widened as new () => Ctor;",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const source = {};",
					"const widened: object = source;",
					"const parsed = widened as number[];",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const source = {};",
					"const widened: object = source;",
					"const parsed = widened as readonly { readonly id: string }[];",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const source = {};",
					"const widened: object = source;",
					"const parsed = widened as { a: true } & { b: false };",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const source = {};",
					"const widened: object = source;",
					"const parsed = widened as { [K in string]: number };",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const source = {};",
					"const widened: object = source;",
					"const parsed = widened as { readonly deep: string };",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"declare const m: Map<string, number>;",
					"const widened: object = m as Map<string, number>;",
					"const parsed = widened as Map<string, number>;",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"declare const s: { readonly id: string };",
					"const widened: (unknown) = s;",
					"const parsed = widened as { readonly id: string };",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const source = {};",
					"const widened: Record<string, unknown> = source;",
					"const parsed = widened as { readonly id: string };",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"const source = {};",
					"const widened: Record<string, unknown> = source;",
					"const parsed = widened as Readonly<Record<string, number>>;",
				].join("\n"),
				errors: [widenThenAssert],
			},
			{
				code: [
					"function read() {",
					"\tconst s: string = 'x';",
					"\tconst w: unknown = s;",
					"\tconst p = w as string;",
					"\treturn p;",
					"}",
				].join("\n"),
				errors: [widenThenAssert],
			},
		],
		valid: [
			{
				code: "// SAFETY: parseUser validated this payload.\ndeclare const input: unknown;\nconst parsed = input as { readonly id: string };",
				documentation: { id: "pass", title: "boundary input with a stated invariant" },
			},
			["const source = { id: 'first' };", "const widened: unknown = source;"].join("\n"),
			"declare const input: unknown; const parsed = input as { readonly id: string };",
			"type Open = Record<string, unknown>; const source = { id: 'one' }; const widened: Open = source;",
			"const count = -1; const widened: unknown = count;",
			["const s = 'x';", "function f() { const w: unknown = s; }"].join("\n"),
			"let n = 1; n = 2; const u: unknown = n;",
			'let widened: unknown = { id: "one" }; const parsed = widened as { readonly id: string };',
			'const source = { id: "one" }; const widened: unknown = source; const parsed = widened as object;',
			'const source = { id: "one" }; const widened = source; const parsed = widened as { readonly id: string };',
			"const parsed = source.id as { readonly id: string };",
			"const parsed = undeclared as { readonly id: string };",
			"function read(widened: unknown) { const parsed = widened as { readonly id: string }; }",
			[
				"function declare() {",
				"\tconst source = { id: 'one' };",
				"\treturn source;",
				"}",
				"function use(source: object) {",
				"\tconst parsed = source as { readonly id: string };",
				"\treturn parsed;",
				"}",
			].join("\n"),
			[
				"function make() {",
				"\tconst source = { id: 'one' };",
				"\tconst widened: unknown = source;",
				"\treturn () => widened as { readonly id: string };",
				"}",
			].join("\n"),
			// Evidence the helper cannot establish stays unreported.
			"class Owner {}\nconst made = new Owner();\nconst widened: object = made;\nconst parsed = widened as Owner;",
			"declare namespace NS { export type Thing = { readonly id: string } }\nconst source = { id: 'x' };\nconst widened: object = source;\nconst parsed = widened as NS.Thing;",
			"const s = {};\nfunction g() { const w: unknown = s; const p = w as { readonly id: string }; return p; }",
			"const u: unknown = ghost; const p = u as { readonly id: string };",
			"declare function getValue(): Map<string, number>;\nconst w = getValue() as unknown;\nconst p = w as Map<string, number>;",
			"function g() { const b: object = {}; const w: unknown = b; const p2 = w as { readonly id: string }; return p2; }",
			"function read(input) { const widened: unknown = input; return widened as { readonly id: string }; }",
			"const widened: Record<string, unknown> = {}; const parsed = widened as Map<string, string>;",
			"const widened: Record<string, unknown> = {}; const parsed = widened as Readonly;",
			"const widened: Record<string, unknown> = {}; const parsed = widened as Record;",
			"const widened: Record<string, unknown> = {}; const parsed = widened as string;",
		],
	});
});
