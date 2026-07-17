import { describe } from "vitest";
import rule from "$oxc-rules/prefer-idiv";

import { ts } from "./rule-testers";

describe("prefer-idiv", () => {
	ts.run("prefer-idiv", rule, {
		invalid: [
			// Simple division - auto-fix cases
			{
				code: "math.floor(x / y);",
				documentation: { id: "fail", title: "floor division expression" },
				errors: [{ messageId: "useIdiv" }],
				output: "x.idiv(y);",
			},
			{
				code: "const result = math.floor(a / b);",
				errors: [{ messageId: "useIdiv" }],
				output: "const result = a.idiv(b);",
			},
			{
				code: "math.floor((a + b) / c);",
				errors: [{ messageId: "useIdiv" }],
				output: "(a + b).idiv(c);",
			},
			{
				code: "math.floor(a / (b + c));",
				errors: [{ messageId: "useIdiv" }],
				output: "a.idiv(b + c);",
			},
			{
				code: "math.floor(foo() / bar());",
				errors: [{ messageId: "useIdiv" }],
				output: "foo().idiv(bar());",
			},
			{
				code: "math.floor(100 / 3);",
				errors: [{ messageId: "useIdiv" }],
				output: "(100).idiv(3);",
			},
			{
				code: "math.floor(x / 2);",
				errors: [{ messageId: "useIdiv" }],
				output: "x.idiv(2);",
			},
			{
				code: "math.floor((x * y) / (z + w));",
				errors: [{ messageId: "useIdiv" }],
				output: "(x * y).idiv(z + w);",
			},
			{
				code: "math.floor(-x / y);",
				errors: [{ messageId: "useIdiv" }],
				output: "(-x).idiv(y);",
			},
			{
				code: "math.floor((a && b) / c);",
				errors: [{ messageId: "useIdiv" }],
				output: "(a && b).idiv(c);",
			},
			{
				code: "math.floor((x = y) / z);",
				errors: [{ messageId: "useIdiv" }],
				output: "(x = y).idiv(z);",
			},
			// Computed property access
			{
				code: 'math["floor"](x / y);',
				errors: [{ messageId: "useIdiv" }],
				output: "x.idiv(y);",
			},
			// Type assertions on the call expression
			{
				code: "(math.floor(x / y) as number);",
				errors: [{ messageId: "useIdiv" }],
				output: "(x.idiv(y) as number);",
			},
			// Type assertions on the argument (unwraps to x / y, not (x) / y)
			{
				code: "math.floor((x / y) as number);",
				errors: [{ messageId: "useIdiv" }],
				output: "x.idiv(y);",
			},
			// Non-null assertion on the argument
			{
				code: "math.floor((x / y)!);",
				errors: [{ messageId: "useIdiv" }],
				output: "x.idiv(y);",
			},
			// Multiple calls in same expression
			{
				code: "math.floor(a / b) + math.floor(c / d);",
				errors: [{ messageId: "useIdiv" }, { messageId: "useIdiv" }],
				output: "a.idiv(b) + c.idiv(d);",
			},
			{
				code: "math.floor(a / b / c);",
				errors: [{ messageId: "useIdiv" }],
				output: "(a / b).idiv(c);",
			},
			{
				code: "math.floor(x / y / z / w);",
				errors: [{ messageId: "useIdiv" }],
				output: "(x / y / z).idiv(w);",
			},
			{
				code: "const result = math.floor(a / b / c);",
				errors: [{ messageId: "useIdiv" }],
				output: "const result = (a / b).idiv(c);",
			},
			{
				code: "math.floor(a / (b / c));",
				errors: [{ messageId: "useIdiv" }],
				output: "a.idiv(b / c);",
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
