import { describe } from "vitest";
import rule from "$oxc-rules/array-type-generic";

import { tsx } from "./rule-testers";

describe("array-type-generic", () => {
	// @ts-expect-error -- Shut up
	tsx.run("array-type-generic", rule, {
		invalid: [
			{
				code: "type A = string[];",
				errors: [{ messageId: "useGenericArrayType" }],
				output: "type A = Array<string>;",
			},
			{
				code: "type B = readonly number[];",
				errors: [{ messageId: "useGenericArrayType" }],
				output: "type B = ReadonlyArray<number>;",
			},
			{
				code: "type C = [number, string][];",
				errors: [{ messageId: "useGenericArrayType" }],
				output: "type C = Array<[number, string]>;",
			},
			{
				code: "type D = string[][];",
				errors: [{ messageId: "useGenericArrayType" }],
				output: "type D = Array<Array<string>>;",
			},
			{
				code: "type E = readonly string[][];",
				errors: [{ messageId: "useGenericArrayType" }],
				output: "type E = ReadonlyArray<Array<string>>;",
			},
			{
				code: "type F = (string | number)[];",
				errors: [{ messageId: "useGenericArrayType" }],
				output: "type F = Array<string | number>;",
			},
			{
				code: "const values: string[] = [];",
				errors: [{ messageId: "useGenericArrayType" }],
				output: "const values: Array<string> = [];",
			},
		],
		valid: [
			"type Point = [x: number, y: number];",
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
