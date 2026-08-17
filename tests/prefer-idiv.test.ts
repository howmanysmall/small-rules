import { describe } from "vitest";
import rule from "$oxc-rules/roblox/prefer-idiv";

import { ts } from "./rule-testers";

describe("prefer-idiv", () => {
	ts.run("prefer-idiv", rule, {
		invalid: [
			// Simple division - auto-fix cases
			{
				code: "math.floor(x / y);",
				output: "x.idiv(y);",
				errors: [{ messageId: "useIdiv" }],
				documentation: { id: "fail", title: "floor division expression" },
			},
			{
				code: "const result = math.floor(a / b);",
				output: "const result = a.idiv(b);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor((a + b) / c);",
				output: "(a + b).idiv(c);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(a / (b + c));",
				output: "a.idiv(b + c);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(foo() / bar());",
				output: "foo().idiv(bar());",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(100 / 3);",
				output: "(100).idiv(3);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(x / 2);",
				output: "x.idiv(2);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor((x * y) / (z + w));",
				output: "(x * y).idiv(z + w);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(-x / y);",
				output: "(-x).idiv(y);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor((a && b) / c);",
				output: "(a && b).idiv(c);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor((x = y) / z);",
				output: "(x = y).idiv(z);",
				errors: [{ messageId: "useIdiv" }],
			},
			// Multiplication by a reciprocal literal (1/n) - auto-fix cases
			{
				code: "math.floor(value * 0.5);",
				output: "value.idiv(2);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(x * 0.25);",
				output: "x.idiv(4);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(x * 0.1);",
				output: "x.idiv(10);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(x * 0.2);",
				output: "x.idiv(5);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(0.5 * x);",
				output: "x.idiv(2);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor((a + b) * 0.5);",
				output: "(a + b).idiv(2);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(foo() * 0.125);",
				output: "foo().idiv(8);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(x * (0.5));",
				output: "x.idiv(2);",
				errors: [{ messageId: "useIdiv" }],
			},
			// Computed property access
			{
				code: 'math["floor"](x / y);',
				output: "x.idiv(y);",
				errors: [{ messageId: "useIdiv" }],
			},
			// Type assertions on the call expression
			{
				code: "(math.floor(x / y) as number);",
				output: "(x.idiv(y) as number);",
				errors: [{ messageId: "useIdiv" }],
			},
			// Type assertions on the argument (unwraps to x / y, not (x) / y)
			{
				code: "math.floor((x / y) as number);",
				output: "x.idiv(y);",
				errors: [{ messageId: "useIdiv" }],
			},
			// Non-null assertion on the argument
			{
				code: "math.floor((x / y)!);",
				output: "x.idiv(y);",
				errors: [{ messageId: "useIdiv" }],
			},
			// Multiple calls in same expression
			{
				code: "math.floor(a / b) + math.floor(c / d);",
				output: "a.idiv(b) + c.idiv(d);",
				errors: [{ messageId: "useIdiv" }, { messageId: "useIdiv" }],
			},
			{
				code: "math.floor(a / b / c);",
				output: "(a / b).idiv(c);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(x / y / z / w);",
				output: "(x / y / z).idiv(w);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "const result = math.floor(a / b / c);",
				output: "const result = (a / b).idiv(c);",
				errors: [{ messageId: "useIdiv" }],
			},
			{
				code: "math.floor(a / (b / c));",
				output: "a.idiv(b / c);",
				errors: [{ messageId: "useIdiv" }],
			},
		],
		valid: [
			// Already using idiv
			{
				code: "x.idiv(y);",
				documentation: { id: "pass", title: "integer division method" },
			},
			"a.idiv(b).idiv(c);",
			// Not a division
			"math.floor(x);",
			"math.floor(x * y);",
			// Multiplication by a non-reciprocal, out-of-range, or non-number
			// value
			"math.floor(x * 0.3);",
			"math.floor(x * 2);",
			"math.floor(x * 0);",
			"math.floor(x * -0.5);",
			'math.floor(x * "0.5");',
			// Literal receivers cannot be converted to .idiv()
			"math.floor(2 * 0.5);",
			"math.floor(0.5 * 2);",
			"math.floor(0.5 * 0.5);",
			"math.floor(x + y);",
			"math.floor(x - y);",
			"math.floor(x % y);",
			"math.floor(x ** y);",
			// No arguments
			"math.floor();",
			// Spread arguments
			"math.floor(...values);",
			// Multiple arguments (not a single division)
			"math.floor(x / y, z);",
			// Shadowed math identifier
			{
				code: "const math = { floor: () => 0 }; math.floor(x / y);",
			},
			// Optional chaining on math - should not match
			"math?.floor(x / y);",
			// Optional chaining on floor - should not match
			"math.floor?.(x / y);",
			// Not the floor method
			"math.ceil(x / y);",
			"math.round(x / y);",
			// Different object
			"obj.floor(x / y);",
			"myMath.floor(x / y);",
			// Computed property with non-string literal (should not match)
			"math[0](x / y);",
			"math[123](x / y);",
		],
	});
});
