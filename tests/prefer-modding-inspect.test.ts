import { describe } from "vitest";
import rule from "$oxc-rules/prefer-modding-inspect";

import { ts } from "./rule-testers";

describe("prefer-modding-inspect", () => {
	ts.run("prefer-modding-inspect", rule, {
		invalid: [
			{
				code: "const x: ReadonlyRecord<MyEnum, true> = { a: true, b: true };",
				documentation: { id: "fail", title: "boolean record literal" },
				errors: [{ messageId: "preferModdingInspect" }],
				output: "const x = Modding.inspect<Record<MyEnum, true>>();",
			},
			{
				code: "const x: Record<MyEnum, true> = { a: true, b: true };",
				errors: [{ messageId: "preferModdingInspect" }],
				output: "const x = Modding.inspect<Record<MyEnum, true>>();",
			},
			{
				code: "const x: ReadonlyRecord<SomeEnum, true> = { memberA: true, memberB: true, memberC: true };",
				errors: [{ messageId: "preferModdingInspect" }],
				output: "const x = Modding.inspect<Record<SomeEnum, true>>();",
			},
			{
				code: "export const x: ReadonlyRecord<MyEnum, true> = { a: true };",
				errors: [{ messageId: "preferModdingInspect" }],
				output: "export const x = Modding.inspect<Record<MyEnum, true>>();",
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
