import { describe } from "vitest";
import rule from "$oxc-rules/prefer-math-min-max";

import { ts } from "./rule-testers";

describe("prefer-math-min-max", () => {
	// @ts-expect-error -- RuleTester types are still awkward here.
	ts.run("prefer-math-min-max", rule, {
		invalid: [
			{
				code: "height > 50 ? 50 : height;",
				errors: [{ messageId: "preferMathMethod" }],
				output: "math.min(height, 50);",
			},
			{
				code: "height >= 50 ? 50 : height;",
				errors: [{ messageId: "preferMathMethod" }],
				output: "math.min(height, 50);",
			},
			{
				code: "height < 50 ? height : 50;",
				errors: [{ messageId: "preferMathMethod" }],
				output: "math.min(height, 50);",
			},
			{
				code: "height <= 50 ? height : 50;",
				errors: [{ messageId: "preferMathMethod" }],
				output: "math.min(height, 50);",
			},
			{
				code: "height > 50 ? height : 50;",
				errors: [{ messageId: "preferMathMethod" }],
				output: "math.max(height, 50);",
			},
			{
				code: "height >= 50 ? height : 50;",
				errors: [{ messageId: "preferMathMethod" }],
				output: "math.max(height, 50);",
			},
			{
				code: "height < 50 ? 50 : height;",
				errors: [{ messageId: "preferMathMethod" }],
				output: "math.max(height, 50);",
			},
			{
				code: "height <= 50 ? 50 : height;",
				errors: [{ messageId: "preferMathMethod" }],
				output: "math.max(height, 50);",
			},
			{
				code: "object.height > 50 ? 50 : object.height;",
				errors: [{ messageId: "preferMathMethod" }],
				output: "math.min(object.height, 50);",
			},
			{
				code: "height > 50 ? 50 : (height as number);",
				errors: [{ messageId: "preferMathMethod" }],
				output: "math.min(height, 50);",
			},
			{
				code: "((first, second) > limit ? limit : (first, second));",
				errors: [{ messageId: "preferMathMethod" }],
				output: "(math.min((first, second), limit));",
			},
		],
		valid: [
			"math.min(height, 50);",
			"math.max(height, 50);",
			"height > 50 ? height + 1 : height;",
			"height < 50 ? 0 : height;",
			"foo ? 1 : 2;",
			"current() > 50 ? 50 : current();",
			"const math = { min(left: number, right: number) { return left; }, max(left: number, right: number) { return right; } }; height > 50 ? 50 : height;",
			'const height: string = "100"; height > 50 ? 50 : height;',
			'const height = "100"; height > 50 ? 50 : height;',
			"function clamp(height: string) { return height > 50 ? 50 : height; }",
		],
	});
});
