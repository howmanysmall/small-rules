import { describe } from "vitest";
import rule from "$oxc-rules/general/prefer-class-properties";

import { js } from "./rule-testers";

const classPropertyErrors = [
	{
		message:
			"Class property declarations are disabled by rule configuration (mode: 'never'). Move initialization into the constructor: this.propertyName = value; inside constructor().",
	},
];
const assignErrors = [
	{
		message:
			"Constructor assigns a literal value to this.property. Literals are static and known at class definition time. Move to a class property declaration: propertyName = value; at class level. This clarifies intent and reduces constructor complexity.",
	},
];

describe("prefer-class-properties", () => {
	js.run("prefer-class-properties", rule, {
		invalid: [
			// 'never' mode - class properties are not allowed
			{ code: 'class Foo { foo = "bar"; }', options: ["never"], errors: classPropertyErrors },
			{ code: "class Foo { foo = bar(); }", options: ["never"], errors: classPropertyErrors },
			{ code: "class Foo { foo = 123; }", options: ["never"], errors: classPropertyErrors },

			// 'always' mode - constructor assignments of literals are not allowed
			{
				code: "class Foo { constructor() { this.foo = 123; } }",
				options: ["always"],
				errors: [
					{
						message:
							"Constructor assigns a literal value to this.property. Literals are static and known at class definition time. Move to a class property declaration: propertyName = value; at class level. This clarifies intent and reduces constructor complexity.",
					},
				],
				documentation: { id: "fail", title: "Constructor literal class property" },
			},
			{
				code: "const Foo = class { constructor() { this.foo = 123; } };",
				options: ["always"],
				errors: assignErrors,
			},
			{ code: "class Foo { constructor() { this.foo = false; } }", options: ["always"], errors: assignErrors },
			{
				code: "class Foo { constructor() { this.foo = /something/; } }",
				options: ["always"],
				errors: assignErrors,
			},
			{ code: "class Foo { constructor() { this.foo = '123'; } }", options: ["always"], errors: assignErrors },
			{
				code: "class Foo { constructor() { this.foo = '123'.toUpperCase(); } }",
				options: ["always"],
				errors: assignErrors,
			},
			// MemberExpression on literal (covers line 29)
			{
				code: "class Foo { constructor() { this.foo = 'bar'.length; } }",
				options: ["always"],
				errors: assignErrors,
			},
			{ code: "class Foo { constructor() { this.foo = []; } }", options: ["always"], errors: assignErrors },
			{ code: "class Foo { constructor() { this.foo = [, 123]; } }", options: ["always"], errors: assignErrors },
			{ code: "class Foo { constructor() { this.foo = {}; } }", options: ["always"], errors: assignErrors },
			{
				code: "class Foo { constructor() { this.foo = [123, 456, 789]; } }",
				options: ["always"],
				errors: assignErrors,
			},
			{
				code: "class Foo { constructor() { this.foo = [123, [456, 789]]; } }",
				options: ["always"],
				errors: assignErrors,
			},
			{
				code: "class Foo { constructor() { this.foo = {foo: 123, bar: {baz: '456'}}; } }",
				options: ["always"],
				errors: assignErrors,
			},
			{ code: "class Foo { constructor() { this['foo'] = 123; } }", options: ["always"], errors: assignErrors },
		],
		valid: [
			// 'always' mode - class properties are fine
			{
				code: 'class Foo { foo = "bar"; }',
				options: ["always"],
				documentation: { id: "pass", title: "Existing class property declaration" },
			},
			{ code: "class Foo { foo = bar(); }", options: ["always"] },
			{ code: "class Foo { foo = 123; }", options: ["always"] },

			// 'never' mode - static properties are still allowed
			{ code: 'class Foo { static foo = "bar"; }', options: ["never"] },

			// 'always' mode - static properties are fine
			{ code: 'class Foo { static foo = "bar"; }', options: ["always"] },

			// 'never' mode - constructor assignments are fine
			{ code: "class Foo { constructor() { this.foo = 123; } }", options: ["never"] },
			{ code: "class Foo { constructor() { this.foo = '123'; } }", options: ["never"] },

			// 'always' mode - computed properties are fine (can't be class
			// properties)
			{ code: "class Foo { constructor() { this[foo] = 123; } }", options: ["always"] },
			{ code: "class Foo { constructor() { this.foo[bar] = 123; } }", options: ["always"] },

			// 'always' mode - nested member expressions are fine
			{ code: "class Foo { constructor() { this.foo[bar].baz = 123; } }", options: ["always"] },

			// 'always' mode - non-literal assignments are fine
			{ code: "class Foo { constructor() { initialize(); } }", options: ["always"] },
			{ code: "class Foo { constructor() { this.foo = foo(); } }", options: ["always"] },
			{ code: "class Foo { constructor() { this.foo = this.defaults.theme; } }", options: ["always"] },
			{ code: "class Foo { constructor() { this.foo = { ...defaults }; } }", options: ["always"] },
			{ code: "class Foo { constructor() { this.foo = [123, ...values]; } }", options: ["always"] },
			{ code: "class Foo { constructor() { this.foo = factory.create(); } }", options: ["always"] },

			// 'always' mode - conditional assignments are fine (not top-level in
			// constructor)
			{ code: "class Foo { constructor() { if (something) { this.foo = 123; } } }", options: ["always"] },

			// 'always' mode - assignments in other methods are fine
			{ code: "class Foo { somethingElse() { this.foo = 123; } }", options: ["always"] },

			// 'always' mode - arrays/objects with non-literals are fine
			{ code: "class Foo { constructor() { this.foo = [123, bar, 456]; } }", options: ["always"] },
			{ code: "class Foo { constructor() { this.foo = {foo: 123, bar: baz}; } }", options: ["always"] },
			{ code: "class Foo { constructor() { this.foo = {[foo]: 123}; } }", options: ["always"] },
		],
	});
});
