import { describe } from "vitest";
import rule from "$oxc-rules/prefer-class-properties";

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
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	js.run("prefer-class-properties", rule, {
		invalid: [
			// 'never' mode - class properties are not allowed
			{ code: 'class Foo { foo = "bar"; }', errors: classPropertyErrors, options: ["never"] },
			{ code: "class Foo { foo = bar(); }", errors: classPropertyErrors, options: ["never"] },
			{ code: "class Foo { foo = 123; }", errors: classPropertyErrors, options: ["never"] },

			// 'always' mode - constructor assignments of literals are not allowed
			{ code: "class Foo { constructor() { this.foo = 123; } }", errors: assignErrors, options: ["always"] },
			{
				code: "const Foo = class { constructor() { this.foo = 123; } };",
				errors: assignErrors,
				options: ["always"],
			},
			{ code: "class Foo { constructor() { this.foo = false; } }", errors: assignErrors, options: ["always"] },
			{
				code: "class Foo { constructor() { this.foo = /something/; } }",
				errors: assignErrors,
				options: ["always"],
			},
			{ code: "class Foo { constructor() { this.foo = '123'; } }", errors: assignErrors, options: ["always"] },
			{
				code: "class Foo { constructor() { this.foo = '123'.toUpperCase(); } }",
				errors: assignErrors,
				options: ["always"],
			},
			// MemberExpression on literal (covers line 29)
			{
				code: "class Foo { constructor() { this.foo = 'bar'.length; } }",
				errors: assignErrors,
				options: ["always"],
			},
			{ code: "class Foo { constructor() { this.foo = []; } }", errors: assignErrors, options: ["always"] },
			{ code: "class Foo { constructor() { this.foo = {}; } }", errors: assignErrors, options: ["always"] },
			{
				code: "class Foo { constructor() { this.foo = [123, 456, 789]; } }",
				errors: assignErrors,
				options: ["always"],
			},
			{
				code: "class Foo { constructor() { this.foo = [123, [456, 789]]; } }",
				errors: assignErrors,
				options: ["always"],
			},
			{
				code: "class Foo { constructor() { this.foo = {foo: 123, bar: {baz: '456'}}; } }",
				errors: assignErrors,
				options: ["always"],
			},
			{ code: "class Foo { constructor() { this['foo'] = 123; } }", errors: assignErrors, options: ["always"] },
		],
		valid: [
			// 'always' mode - class properties are fine
			{ code: 'class Foo { foo = "bar"; }', options: ["always"] },
			{ code: "class Foo { foo = bar(); }", options: ["always"] },
			{ code: "class Foo { foo = 123; }", options: ["always"] },

			// 'never' mode - static properties are still allowed
			{ code: 'class Foo { static foo = "bar"; }', options: ["never"] },

			// 'always' mode - static properties are fine
			{ code: 'class Foo { static foo = "bar"; }', options: ["always"] },

			// 'never' mode - constructor assignments are fine
			{ code: "class Foo { constructor() { this.foo = 123; } }", options: ["never"] },
			{ code: "class Foo { constructor() { this.foo = '123'; } }", options: ["never"] },

			// 'always' mode - computed properties are fine (can't be class properties)
			{ code: "class Foo { constructor() { this[foo] = 123; } }", options: ["always"] },

			// 'always' mode - nested member expressions are fine
			{ code: "class Foo { constructor() { this.foo[bar].baz = 123; } }", options: ["always"] },

			// 'always' mode - non-literal assignments are fine
			{ code: "class Foo { constructor() { this.foo = foo(); } }", options: ["always"] },

			// 'always' mode - conditional assignments are fine (not top-level in constructor)
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
