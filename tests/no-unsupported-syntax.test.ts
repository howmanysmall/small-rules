import { describe } from "vitest";

import rule from "$oxc-rules/roblox/no-unsupported-syntax";

import { ts } from "./rule-testers";

describe("no-unsupported-syntax", () => {
	ts.run("no-unsupported-syntax", rule, {
		invalid: [
			// globalThis identifier
			{
				code: "globalThis.foo;",
				errors: [{ messageId: "globalThis" }],
			},
			{
				code: "foo.globalThis;",
				errors: [{ messageId: "globalThis" }],
			},
			{
				code: "const value = globalThis;",
				errors: [{ messageId: "globalThis" }],
			},
			// Object property key named globalThis (Identifier is visited)
			{
				code: "const x = { globalThis: 1 };",
				errors: [{ messageId: "globalThis" }],
			},
			// Labeled statements
			{
				code: "outer: while (true) { break outer; }",
				errors: [{ messageId: "label" }],
			},
			// .prototype member access
			{
				code: "Foo.prototype;",
				errors: [{ messageId: "prototype" }],
			},
			{
				code: "Foo.prototype.bar;",
				errors: [{ messageId: "prototype" }],
			},
			// Regex literals
			{
				code: "const r = /abc/u;",
				errors: [{ messageId: "regexLiteral" }],
			},
			// Spread destructuring - object pattern
			{
				code: "const { a, ...rest } = obj;",
				errors: [{ messageId: "spreadDestructuring" }],
				documentation: { id: "fail", title: "Rest element in object destructuring" },
			},
			// Spread destructuring - array pattern
			{
				code: "const [a, ...rest] = arr;",
				errors: [{ messageId: "spreadDestructuring" }],
			},
			// Spread destructuring - array pattern with elision
			{
				code: "const [a, , ...rest] = arr;",
				errors: [{ messageId: "spreadDestructuring" }],
			},
			// Spread destructuring - multiple rest elements
			{
				code: "const { a, ...restA } = obj; const { b, ...restB } = obj2;",
				errors: [{ messageId: "spreadDestructuring" }, { messageId: "spreadDestructuring" }],
			},
			// Spread destructuring - assignment target
			{
				code: "[a, ...rest] = arr;",
				errors: [{ messageId: "spreadDestructuring" }],
			},
			// Options - disabling one check leaves the others active
			{
				code: "globalThis.foo;",
				options: [{ spreadDestructuring: false }],
				errors: [{ messageId: "globalThis" }],
			},
			// Options - explicit true values take the defined branch
			{
				code: "globalThis.foo;",
				options: [
					{
						globalThis: true,
						labels: true,
						prototype: true,
						regexLiterals: true,
						spreadDestructuring: true,
					},
				],
				errors: [{ messageId: "globalThis" }],
			},
		],
		valid: [
			// No unsupported syntax
			"foo.bar;",
			// Non-regex literals
			"const value = 42;",
			'const s = "abc";',
			// Division, not a regex literal
			"const q = a / b;",
			// Computed member access is not .prototype
			'Foo["prototype"];',
			// Private identifier member access is not .prototype
			"class C { #p = 0; read() { return this.#p; } }",
			// Destructuring without rest elements
			{
				code: "const { a, b } = obj;",
				documentation: { id: "pass", title: "Explicit properties" },
			},
			"const [a, b] = arr;",
			// Case labels are not labeled statements
			"switch (x) { case 1: break; }",
			// Options - spread destructuring disabled (object pattern)
			{
				code: "const { a, ...rest } = obj;",
				options: [{ spreadDestructuring: false }],
			},
			// Options - spread destructuring disabled (array pattern)
			{
				code: "const [a, ...rest] = arr;",
				options: [{ spreadDestructuring: false }],
			},
			// Options - globalThis disabled
			{
				code: "globalThis.foo;",
				options: [{ globalThis: false }],
			},
			// Options - labels disabled
			{
				code: "outer: while (true) { break outer; }",
				options: [{ labels: false }],
			},
			// Options - prototype disabled
			{
				code: "Foo.prototype;",
				options: [{ prototype: false }],
			},
			// Options - regex literals disabled
			{
				code: "const r = /abc/u;",
				options: [{ regexLiterals: false }],
			},
		],
	});
});
