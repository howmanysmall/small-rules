import { describe } from "vitest";

import rule from "$oxc-rules/roblox/prefer-modding-inspect";

import { ts } from "./rule-testers";

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
