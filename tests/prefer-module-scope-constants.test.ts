import { describe } from "vitest";
import rule from "$oxc-rules/prefer-module-scope-constants";
import { RuleTester } from "eslint";

import { js } from "./rule-testers";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "script",
	},
});

const moduleScopeErrors = [
	{
		message:
			"You must place screaming snake case at module scope. If this is not meant to be a module-scoped variable, use camelcase instead.",
	},
];

const nonConstErrors = [
	{
		message:
			"You must use `const` when defining screaming snake case variables. If this is not a constant, use camelcase instead.",
	},
];

describe("prefer-module-scope-constants", () => {
	// @ts-expect-error - This is dumb
	js.run("prefer-module-scope-constants", rule, {
		invalid: [
			// Not using const
			{ code: "let FOO = true;", errors: nonConstErrors },
			{ code: "{ let FOO = true; }", errors: nonConstErrors },
			{ code: "function foo() { let FOO = true; }", errors: nonConstErrors },
			{ code: "let foo = false, FOO = true;", errors: nonConstErrors },

			// Not at module scope
			{ code: "{ const FOO = true; }", errors: moduleScopeErrors },
			{ code: "function foo() { const FOO = true; }", errors: moduleScopeErrors },
			{ code: "{ const foo = false, FOO = true; }", errors: moduleScopeErrors },
		],
		valid: [
			// Module scope const - valid
			{ code: "const FOO = true;" },
			// Lowercase - not affected
			{ code: "const foo = true;" },
			{ code: "{ const foo = true; }" },
			// Mixed declaration
			{ code: "const foo = true, FOO = true;" },

			// Destructuring patterns are allowed at any scope
			{ code: "const {FOO} = bar" },
			{ code: "{ const {FOO} = bar; }" },
			{ code: "function foo() { const {FOO} = bar; }" },
			{ code: "{ let {FOO} = bar; }" },
			{ code: "function foo() { let {FOO} = bar; }" },

			// Array destructuring
			{ code: "const [FOO] = bar" },
			{ code: "{ const [FOO] = bar; }" },
			{ code: "function foo() { const [FOO] = bar; }" },
			{ code: "{ let [FOO] = bar; }" },
			{ code: "function foo() { let [FOO] = bar; }" },

			// CommonJS usage
			{ code: "const MY_VALUE = true; module.exports = () => { console.log(MY_VALUE); };" },
		],
	});

	// @ts-expect-error - This is dumb
	ruleTester.run("prefer-module-scope-constants (script)", rule, {
		invalid: [
			// Deeply nested in script mode - not at module scope
			{ code: "function foo() { function bar() { const FOO = true; } }", errors: moduleScopeErrors },
		],
		valid: [
			// Script mode top-level const is valid
			{ code: "const FOO = true;" },
			// First-level function in script mode (CJS wrapper pattern)
			{ code: "function foo() { const FOO = true; }" },
		],
	});
});
