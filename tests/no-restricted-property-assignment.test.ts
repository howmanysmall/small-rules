import { describe } from "vitest";
import rule from "$oxc-rules/no-restricted-property-assignment";

import { js } from "./rule-testers";

describe("no-restricted-property-assignment", () => {
	js.run("no-restricted-property-assignment", rule, {
		invalid: [
			{
				code: "_G.__DEV__ = true;",
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "_G.__DEV__ = true;",
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G", properties: ["__*__"] }] }],
			},
			{
				code: "_G.__PROD__ = true;",
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G", properties: ["__*__"] }] }],
			},
			{
				code: "_G_other.__DEV__ = true;",
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G*", properties: ["__DEV__"] }] }],
			},
			{
				code: '_G["__DEV__"] = false;',
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "_G.anything = 1;",
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G", properties: ["*"] }] }],
			},
			{
				code: '_G[".secret"] = 1;',
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G", properties: ["*"] }] }],
			},
			{
				code: "_G.__DEV__ = 1;",
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__", "__PROD__"] }] }],
			},
			{
				code: "_G.__PROD__ = 1;",
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__", "__PROD__"] }] }],
			},
			{
				code: "_G.__DEV__ = true;",
				errors: [{ messageId: "restrictedCustom" }],
				options: [
					{
						restrictions: [{ message: "No global writes", object: "_G", properties: ["__DEV__"] }],
					},
				],
			},
			{
				code: "config.debug = true;",
				errors: [{ messageId: "restricted" }],
				options: [
					{
						restrictions: [
							{ object: "_G", properties: ["__DEV__"] },
							{ object: "config", properties: ["debug"] },
						],
					},
				],
			},
			{
				code: "_G.__DEV__ ||= true;",
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "_G.__DEV__ += 1;",
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "_G.__DEV__++;",
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "--_G.__DEV__;",
				errors: [{ messageId: "restricted" }],
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "_G.__DEV__ = true; // allowFiles should not suppress on non-matching files",
				errors: [{ messageId: "restricted" }],
				filename: "some/other/file.ts",
				options: [
					{ allowFiles: ["main.server.ts"], restrictions: [{ object: "_G", properties: ["__DEV__"] }] },
				],
			},
		],
		valid: [
			"const x = _G.__DEV__;",
			"_G.__DEV__;",
			{
				code: "_G.__PROD__ = true;",
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "other.__DEV__ = true;",
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "_G.something = true; // glob property pattern should not match non-matching names",
				options: [{ restrictions: [{ object: "_G", properties: ["__*__"] }] }],
			},
			{
				code: "other.__DEV__ = true; // glob object pattern should not match non-matching names",
				options: [{ restrictions: [{ object: "_G*", properties: ["__DEV__"] }] }],
			},
			{
				code: '_G["foo/bar"] = true; // property matching should not use basename semantics',
				options: [{ restrictions: [{ object: "_G", properties: ["bar"] }] }],
			},
			{
				code: "a.b.__DEV__ = true;",
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: '_G["__DEV__"] = x;',
				options: [{ checkComputed: false, restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "_G[someVariable] = x;",
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "x = 1;",
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "_G.__DEV__ = true; // malformed-options-null",
				options: [{ restrictions: [null] }],
			},
			{
				code: "_G.__DEV__ = true; // malformed-options-object",
				options: [{ restrictions: [{ object: 1, properties: ["__DEV__"] }] }],
			},
			{
				code: "_G.__DEV__ = true; // malformed-options-properties-string",
				options: [{ restrictions: [{ object: "_G", properties: "__DEV__" }] }],
			},
			{
				code: "_G.__DEV__ = true; // malformed-options-properties-array",
				options: [{ restrictions: [{ object: "_G", properties: ["__DEV__", 1] }] }],
			},
			{
				code: "_G.__DEV__ = true; // malformed-options-top-level",
				options: [{ restrictions: { object: "_G" } }],
			},
			{
				code: "_G.__DEV__ = true; // malformed-checkComputed",
				options: [{ checkComputed: "yes", restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "_G.__DEV__ = true; // malformed-allowFiles-not-array",
				options: [{ allowFiles: "main.server.ts", restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			{
				code: "_G.__DEV__ = true; // malformed-allowFiles-not-strings",
				options: [{ allowFiles: [42], restrictions: [{ object: "_G", properties: ["__DEV__"] }] }],
			},
			// allowFiles: should suppress reports on matching files
			{
				code: "_G.__DEV__ = true;",
				filename: "main.server.ts",
				options: [
					{ allowFiles: ["main.server.ts"], restrictions: [{ object: "_G", properties: ["__DEV__"] }] },
				],
			},
			{
				code: "_G.__DEV__ = true;",
				filename: "src/main.client.ts",
				options: [
					{ allowFiles: ["main.client.ts"], restrictions: [{ object: "_G", properties: ["__DEV__"] }] },
				],
			},
			{
				code: "_G.__DEV__ = true;",
				filename: "stories/button.story.ts",
				options: [
					{ allowFiles: ["*.story.{ts,tsx}"], restrictions: [{ object: "_G", properties: ["__DEV__"] }] },
				],
			},
			{
				code: "_G.__DEV__ = true;",
				filename: "stories/button.story.tsx",
				options: [
					{ allowFiles: ["*.story.{ts,tsx}"], restrictions: [{ object: "_G", properties: ["__DEV__"] }] },
				],
			},
			{
				code: "_G.__DEV__ = true; // multiple allow patterns",
				filename: "main.server.ts",
				options: [
					{
						allowFiles: ["main.server.ts", "main.client.ts"],
						restrictions: [{ object: "_G", properties: ["__DEV__"] }],
					},
				],
			},
			{
				code: "_G.__DEV__ = true; // multiple allow patterns - second match",
				filename: "main.client.ts",
				options: [
					{
						allowFiles: ["main.server.ts", "main.client.ts"],
						restrictions: [{ object: "_G", properties: ["__DEV__"] }],
					},
				],
			},
			{
				code: "_G.__DEV__++; // allowFiles should work on update expressions too",
				filename: "main.server.ts",
				options: [
					{ allowFiles: ["main.server.ts"], restrictions: [{ object: "_G", properties: ["__DEV__"] }] },
				],
			},
		],
	});
});
