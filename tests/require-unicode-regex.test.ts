import { describe } from "vitest";
import rule from "$oxc-rules/require-unicode-regex";

import { ts } from "./rule-testers";

describe("require-unicode-regex", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ts.run("require-unicode-regex", rule, {
		invalid: [
			{
				code: 'const x = regex("foo");',
				errors: [{ messageId: "requireUnicodeFlag" }],
			},
			{
				code: 'const x = regex("foo", "g");',
				errors: [{ messageId: "requireUnicodeFlag" }],
			},
			{
				code: 'const x = regex("foo", "i");',
				errors: [{ messageId: "requireUnicodeFlag" }],
			},
			{
				code: 'const x = regex("foo", "gi");',
				errors: [{ messageId: "requireUnicodeFlag" }],
			},
			{
				code: 'const x = regex("^/(?<first>.+)/(?<second>[gimsuy]*)$");',
				errors: [{ messageId: "requireUnicodeFlag" }],
			},
			{
				code: 'const x = regex("^/(?<first>.+)/(?<second>[gimsuy]*)$", "s");',
				errors: [{ messageId: "requireUnicodeFlag" }],
			},
		],
		valid: [
			{
				code: 'const x = regex("foo", "u");',
			},
			{
				code: 'const x = regex("foo", "v");',
			},
			{
				code: 'const x = regex("foo", "gu");',
			},
			{
				code: 'const x = regex("foo", "iu");',
			},
			{
				code: 'const x = regex("foo", "gv");',
			},
			{
				code: 'const x = regex("foo", "iv");',
			},
			{
				code: 'const x = regex("^/(?<first>.+)/(?<second>[gimsuy]*)$", "v");',
			},
			{
				code: 'const x = regex("^/(?<first>.+)/(?<second>[gimsuy]*)$", "u");',
			},
			{
				code: 'const x = regex("foo", flagsVariable);',
			},
			{
				code: 'const x = regex("foo", ...flags);',
			},
			{
				code: "const x = someOtherFunc();",
			},
			{
				code: 'const x = somethingElse("foo", "g");',
			},
			{
				code: "const x = /foo/;",
			},
			{
				code: 'const x = new RegExp("foo", "g");',
			},
			{
				code: 'const x = "hello";',
			},
		],
	});
});
