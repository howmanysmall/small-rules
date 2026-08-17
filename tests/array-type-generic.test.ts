import { describe } from "vitest";
import rule from "$oxc-rules/naming/array-type-generic";

import { tsx } from "./rule-testers";

describe("array-type-generic", () => {
	tsx.run("array-type-generic", rule, {
		invalid: [
			{
				code: "type A = string[];",
				output: "type A = Array<string>;",
				errors: [{ messageId: "useGenericArrayType" }],
				documentation: { id: "fail", title: "Bracket array type syntax" },
			},
			{
				code: "type B = readonly number[];",
				output: "type B = ReadonlyArray<number>;",
				errors: [{ messageId: "useGenericArrayType" }],
			},
			{
				code: "type C = [number, string][];",
				output: "type C = Array<[number, string]>;",
				errors: [{ messageId: "useGenericArrayType" }],
			},
			{
				code: "type D = string[][];",
				output: "type D = Array<Array<string>>;",
				errors: [{ messageId: "useGenericArrayType" }],
			},
			{
				code: "type E = readonly string[][];",
				output: "type E = ReadonlyArray<Array<string>>;",
				errors: [{ messageId: "useGenericArrayType" }],
			},
			{
				code: "type Nested = (readonly number[])[];",
				output: "type Nested = Array<ReadonlyArray<number>>;",
				errors: [{ messageId: "useGenericArrayType" }],
			},
			{
				code: "type F = (string | number)[];",
				output: "type F = Array<string | number>;",
				errors: [{ messageId: "useGenericArrayType" }],
			},
			{
				code: "const values: string[] = [];",
				output: "const values: Array<string> = [];",
				errors: [{ messageId: "useGenericArrayType" }],
			},
		],
		valid: [
			{
				code: "type Point = [x: number, y: number];",
				documentation: { id: "pass", title: "Generic array type syntax" },
			},
			"function parseValues(values: [unknown, string, ...unknown[]]): void {}",
			"type OptionalPoint = readonly [x: number, y: number];",
			"type Values = Array<string>;",
			"type Values = ReadonlyArray<string>;",
			"const pairs: Array<[number, string]> = [[1, 'one'], [2, 'two']];",
			"const xs = [1, 2, 3];",
			"const element = <div />;",
		],
	});
});
