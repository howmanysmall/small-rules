import { describe } from "vitest";
import rule from "$oxc-rules/prefer-udim2-shorthand";

import { js } from "./rule-testers";

describe("prefer-udim2-shorthand", () => {
	// @ts-expect-error -- Shut up
	js.run("prefer-udim2-shorthand", rule, {
		invalid: [
			// FromScale pattern tests
			{
				code: "new UDim2(1, 0, 1, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(1, 1);",
			},
			{
				code: "new UDim2(0.5, 0, 0.75, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(0.5, 0.75);",
			},
			{
				code: "const size = new UDim2(100, 0, 200, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "const size = UDim2.fromScale(100, 200);",
			},
			{
				code: "func(new UDim2(1, 0, 2, 0));",
				errors: [{ messageId: "preferFromScale" }],
				output: "func(UDim2.fromScale(1, 2));",
			},

			// FromOffset pattern tests
			{
				code: "new UDim2(0, 1, 0, 1);",
				errors: [{ messageId: "preferFromOffset" }],
				output: "UDim2.fromOffset(1, 1);",
			},
			{
				code: "new UDim2(0, 100, 0, 50);",
				errors: [{ messageId: "preferFromOffset" }],
				output: "UDim2.fromOffset(100, 50);",
			},
			{
				code: "const padding = new UDim2(0, 5, 0, 10);",
				errors: [{ messageId: "preferFromOffset" }],
				output: "const padding = UDim2.fromOffset(5, 10);",
			},
			{
				code: "method(new UDim2(0, 20, 0, 30));",
				errors: [{ messageId: "preferFromOffset" }],
				output: "method(UDim2.fromOffset(20, 30));",
			},

			// Math expressions - fromScale
			{
				code: "new UDim2(1 + 1, 0, 2 + 2, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(1 + 1, 2 + 2);",
			},
			{
				code: "new UDim2(5 / 4, 0, 0.85, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(5 / 4, 0.85);",
			},
			{
				code: "new UDim2(1 * 2, 0, 3 / 4, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(1 * 2, 3 / 4);",
			},
			{
				code: "new UDim2(+0.5, 0, +0.75, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(+0.5, +0.75);",
			},

			// Math expressions - fromOffset
			{
				code: "new UDim2(0, -1, 0, 5);",
				errors: [{ messageId: "preferFromOffset" }],
				output: "UDim2.fromOffset(-1, 5);",
			},
			{
				code: "new UDim2(0, 100 - 10, 0, 50);",
				errors: [{ messageId: "preferFromOffset" }],
				output: "UDim2.fromOffset(100 - 10, 50);",
			},
			{
				code: "new UDim2(0, 10 + 2, 0, 5 * 2);",
				errors: [{ messageId: "preferFromOffset" }],
				output: "UDim2.fromOffset(10 + 2, 5 * 2);",
			},
			{
				code: "new UDim2(8 % 3, 0, 12 % 5, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(8 % 3, 12 % 5);",
			},
			{
				code: "new UDim2(0, 20 % 7, 0, 15 % 4);",
				errors: [{ messageId: "preferFromOffset" }],
				output: "UDim2.fromOffset(20 % 7, 15 % 4);",
			},

			// Variables as arguments
			{
				code: "new UDim2(x, 0, y, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(x, y);",
			},
			{
				code: "new UDim2(0, offset, 0, offset);",
				errors: [{ messageId: "preferFromOffset" }],
				output: "UDim2.fromOffset(offset, offset);",
			},
			{
				code: "new UDim2(0, x, 0, 10);",
				errors: [{ messageId: "preferFromOffset" }],
				output: "UDim2.fromOffset(x, 10);",
			},

			// Expressions with variables
			{
				code: "new UDim2(10 / x, 0, 10 % y, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(10 / x, 10 % y);",
			},
			{
				code: "new UDim2(x + 1, 0, 1 - y, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(x + 1, 1 - y);",
			},
			{
				code: "new UDim2(x * 2, 0, 2 / z, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(x * 2, 2 / z);",
			},
		],
		valid: [
			// Mixed values - not simplifiable
			"new UDim2(1, 2, 3, 4);",
			"new UDim2(1, 0, 2, 3);",
			"new UDim2(1, 2, 0, 0);",
			"new UDim2(1 + (value && 2), 0, 3, 0);",
			"new UDim2(!flag, 0, 1, 0);",
			"new UDim2(0, -offset, 1, 2);",
			"new UDim2(0, -getOffset(), 1, 2);",
			"new UDim2(1 % 0, 0, 1, 2);",
			"new UDim2(1 / 0, 0, 1, 2);",
			"new UDim2(1, ...offsets, 1, 0);",

			// All zeros - explicitly allowed
			"new UDim2(0, 0, 0, 0);",

			// Already using shorthands
			"UDim2.fromScale(1, 1);",
			"UDim2.fromOffset(5, 10);",
			"const x = UDim2.fromScale(0.5, 0.75);",
			"const y = UDim2.fromOffset(100, 50);",

			// Different constructors
			"new UDim(0);",
			"new Vector2(1, 2);",
			"new Color3(1, 1, 1);",

			// Wrong argument counts
			"new UDim2();",
			"new UDim2(1);",
			"new UDim2(1, 2);",
			"new UDim2(1, 2, 3);",
			"new UDim2(1, 2, 3, 4, 5);",

			// Other constructors
			"const c = someOtherConstructor(0, 0, 0, 0);",

			// Unsupported operators (bitwise, logical, etc)
			"new UDim2(1 & 2, 0, 1 | 2, 0);",
			"new UDim2(1 ^ 2, 0, 1 << 2, 0);",
			"new UDim2(1 >> 2, 0, 1 >>> 2, 0);",

			// Non-literal values (booleans, null, etc in Literal nodes)
			"new UDim2(true, 0, false, 0);",

			// String literals (not supported)
			"new UDim2('hello', 0, 'world', 0);",
		],
	});
});
