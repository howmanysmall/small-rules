import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/roblox/prefer-modding-inspect";

describe("prefer-modding-inspect", () => {
	ts.run("prefer-modding-inspect", rule, {
		invalid: [
			{
				code: "const x: ReadonlyRecord<MyEnum, true> = { a: true, b: true };",
				output: "const x = Modding.inspect<Record<MyEnum, true>>();",
				errors: [{ messageId: "preferModdingInspect" }],
				documentation: { id: "fail", title: "boolean record literal" },
			},
			{
				code: "const x: Record<MyEnum, true> = { a: true, b: true };",
				output: "const x = Modding.inspect<Record<MyEnum, true>>();",
				errors: [{ messageId: "preferModdingInspect" }],
			},
			{
				code: "const x: ReadonlyRecord<SomeEnum, true> = { memberA: true, memberB: true, memberC: true };",
				output: "const x = Modding.inspect<Record<SomeEnum, true>>();",
				errors: [{ messageId: "preferModdingInspect" }],
			},
			{
				code: "export const x: ReadonlyRecord<MyEnum, true> = { a: true };",
				output: "export const x = Modding.inspect<Record<MyEnum, true>>();",
				errors: [{ messageId: "preferModdingInspect" }],
			},
			{
				// `Modding.inspect` cannot list the keys of `string`, so the fix
				// would lose them: the report stays and the fix is withheld.
				code: "const allowedCommands: Record<string, true> = { kick: true, ban: true };",
				output: null,
				errors: [{ data: { enumType: "string" }, messageId: "preferModdingInspect" }],
			},
			{
				code: "const slots: Record<number, true> = { 1: true, 2: true };",
				output: null,
				errors: [{ data: { enumType: "number" }, messageId: "preferModdingInspect" }],
			},
			{
				code: "const tags: Record<symbol, true> = {};",
				output: null,
				errors: [{ data: { enumType: "symbol" }, messageId: "preferModdingInspect" }],
			},
			{
				code: `
const handlers: Record<\`on\${string}\`, true> = { onOpen: true };
`,
				output: null,
				errors: [{ messageId: "preferModdingInspect" }],
			},
			{
				code: "const names: Record<Lowercase<string>, true> = { alpha: true };",
				output: null,
				errors: [{ data: { enumType: "Lowercase<string>" }, messageId: "preferModdingInspect" }],
			},
			{
				code: "const keys: Record<PropertyKey, true> = { alpha: true };",
				output: null,
				errors: [{ data: { enumType: "PropertyKey" }, messageId: "preferModdingInspect" }],
			},
			{
				code: "const keys: Record<MyEnum | string, true> = { alpha: true };",
				output: null,
				errors: [{ data: { enumType: "MyEnum | string" }, messageId: "preferModdingInspect" }],
			},
			{
				code: 'const keys: Record<"alpha" | "beta", true> = { alpha: true, beta: true };',
				output: 'const keys = Modding.inspect<Record<"alpha" | "beta", true>>();',
				errors: [{ data: { enumType: '"alpha" | "beta"' }, messageId: "preferModdingInspect" }],
			},
			{
				// The fix would delete the comment, so it is withheld.
				code: "const x: Record<MyEnum, true> = {\n\ta: true, // red\n\tb: true,\n};",
				output: null,
				errors: [{ messageId: "preferModdingInspect" }],
			},
		],
		valid: [
			{
				code: "const x = { a: true, b: true };",
				documentation: { id: "pass", title: "plain object without record type" },
			},
			"const x: SomeOtherType = { a: true, b: true };",
			"const x: ReadonlyRecord<MyEnum, true> = { a: true, b: false };",
			"const x: ReadonlyRecord<MyEnum, true> = { a: true, b: getDefault() };",
			"const { x }: { x: ReadonlyRecord<MyEnum, true> } = { x: { a: true, b: true } };",
			"const x: ReadonlyRecord<MyEnum, false> = { a: true, b: true };",
			"const x: ReadonlyRecord<MyEnum, true | false> = { a: true, b: true };",
			"const x: ReadonlyRecord<MyEnum, true> = { a: true, ...defaults };",
			"let x: ReadonlyRecord<MyEnum, true>;",
			"const x: ReadonlyRecord<MyEnum, string> = { a: true, b: true };",
			"const x: ReadonlyRecord<MyEnum> = {};",
		],
	});
});
