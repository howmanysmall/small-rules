import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-runtime-typeof";
import { ts } from "$test/rule-testers";

const runtimeTypeof = { messageId: "runtimeTypeof" };

describe("no-runtime-typeof", () => {
	ts.run("no-runtime-typeof", rule, {
		invalid: [
			{
				code: "if (typeof input === 'string') use(input);",
				errors: [{ messageId: "runtimeTypeof" }],
				documentation: { id: "fail", title: "ad hoc typeof narrowing" },
			},
			{
				code: 'function isString(value: unknown): value is string { return typeof value === "string"; }',
				errors: [runtimeTypeof],
			},
			{
				code: 'function parse(value: unknown): string {\n\tif (typeof value !== "string") throw new Error();\n\treturn value;\n}',
				options: [{}],
				errors: [runtimeTypeof],
			},
			{
				code: 'function isString(value: unknown): value is string { const check = () => typeof value === "string"; return check(); }',
				options: [{ allowInTypeGuards: true }],
				errors: [runtimeTypeof],
			},
			{ code: "const kind = typeof value;", options: [{ allowInTypeGuards: true }], errors: [runtimeTypeof] },
		],
		valid: [
			{
				code: 'function isString(value: unknown): value is string { return typeof value === "string"; }',
				options: [{ allowInTypeGuards: true }],
				documentation: { id: "pass", title: "explicit type-guard exception" },
			},
			{
				code: 'function assertText(value: unknown): asserts value is string { if (typeof value !== "string") throw new Error(); }',
				options: [{ allowInTypeGuards: true }],
			},
			{
				code: 'const isText = (value: unknown): value is string => typeof value === "string";',
				options: [{ allowInTypeGuards: true }],
			},
			"const value = input;",
		],
	});
});
