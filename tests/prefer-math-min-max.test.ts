import { describe } from "vitest";
import rule from "$oxc-rules/roblox/prefer-math-min-max";

import { ts } from "./rule-testers";

describe("prefer-math-min-max", () => {
	ts.run("prefer-math-min-max", rule, {
		invalid: [
			{
				code: "height > 50 ? 50 : height;",
				output: "math.min(height, 50);",
				errors: [{ messageId: "preferMathMethod" }],
				documentation: { id: "fail", title: "ternary minimum expression" },
			},
			{
				code: "height >= 50 ? 50 : height;",
				output: "math.min(height, 50);",
				errors: [{ messageId: "preferMathMethod" }],
			},
			{
				code: "height < 50 ? height : 50;",
				output: "math.min(height, 50);",
				errors: [{ messageId: "preferMathMethod" }],
			},
			{
				code: "height <= 50 ? height : 50;",
				output: "math.min(height, 50);",
				errors: [{ messageId: "preferMathMethod" }],
			},
			{
				code: "height > 50 ? height : 50;",
				output: "math.max(height, 50);",
				errors: [{ messageId: "preferMathMethod" }],
			},
			{
				code: "height >= 50 ? height : 50;",
				output: "math.max(height, 50);",
				errors: [{ messageId: "preferMathMethod" }],
			},
			{
				code: "height < 50 ? 50 : height;",
				output: "math.max(height, 50);",
				errors: [{ messageId: "preferMathMethod" }],
			},
			{
				code: "height <= 50 ? 50 : height;",
				output: "math.max(height, 50);",
				errors: [{ messageId: "preferMathMethod" }],
			},
			{
				code: "object.height > 50 ? 50 : object.height;",
				output: "math.min(object.height, 50);",
				errors: [{ messageId: "preferMathMethod" }],
			},
			{
				code: "height > 50 ? 50 : (height as number);",
				output: "math.min(height, 50);",
				errors: [{ messageId: "preferMathMethod" }],
			},
			{
				code: "((first, second) > limit ? limit : (first, second));",
				output: "(math.min((first, second), limit));",
				errors: [{ messageId: "preferMathMethod" }],
			},
			{
				code: "(<number>height) > 50 ? 50 : (<number>height);",
				output: "math.min(<number>height, 50);",
				errors: [{ messageId: "preferMathMethod" }],
			},
			{
				code: "function clamp(height: Number) { return height > 50 ? 50 : height; }",
				output: "function clamp(height: Number) { return math.min(height, 50); }",
				errors: [{ messageId: "preferMathMethod" }],
			},
			{
				code: "function clamp(height) { return height > 50 ? 50 : height; }",
				output: "function clamp(height) { return math.min(height, 50); }",
				errors: [{ messageId: "preferMathMethod" }],
			},
		],
		valid: [
			{
				code: "math.min(height, 50);",
				documentation: { id: "pass", title: "math minimum call" },
			},
			"math.max(height, 50);",
			"height > 50 ? height + 1 : height;",
			"height < 50 ? 0 : height;",
			"foo ? 1 : 2;",
			"current() > 50 ? 50 : current();",
			"const math = { min(left: number, right: number) { return left; }, max(left: number, right: number) { return right; } }; height > 50 ? 50 : height;",
			'const height: string = "100"; height > 50 ? 50 : height;',
			'const height = "100"; height > 50 ? 50 : height;',
			"function clamp(height: string) { return height > 50 ? 50 : height; }",
			"function clamp(height: String) { return height > 50 ? 50 : height; }",
			"function clamp(height = '100') { return height > 50 ? 50 : height; }",
			"height === 50 ? 50 : height;",
			"height > current() ? current() : height;",
			"current() > height ? height : current();",
			"height > 50 ? height : width;",
			"function clamp(height: unknown) { return height > 50 ? 50 : height; }",
			"const height: unknown = 100; height > 50 ? 50 : height;",
			"const height: string | number = 100; height > 50 ? 50 : height;",
			"(<string>height) > 50 ? 50 : (<string>height);",
		],
	});
});
