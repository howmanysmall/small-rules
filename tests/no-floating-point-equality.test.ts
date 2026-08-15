import { describe } from "vitest";
import rule from "$oxc-rules/general/no-floating-point-equality";

import { ts } from "./rule-testers";

describe("no-floating-point-equality", () => {
	ts.run("no-floating-point-equality", rule, {
		invalid: [
			{
				code: "const isReady = progress === 0.2;",
				documentation: { id: "fail", title: "Exact comparison with an inexact decimal" },
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "const changed = sample() !== 2 / 7;",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "const taxRate = 0.075; const matches = received === taxRate;",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "if (measurement <= 6.4 && measurement >= 6.4) record(measurement);",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "switch (opacity) { case 0.2: dim(); break; case 4 / 9: hide(); }",
				errors: [{ messageId: "exactFloatComparison" }, { messageId: "exactFloatComparison" }],
			},
			{
				code: "import { expect } from 'vitest'; expect(calculateRatio()).toBe(0.2);",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "import assert from 'node:assert/strict'; assert.notStrictEqual(actualScale, 0.2);",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "import * as assert from 'assert'; assert.deepStrictEqual(actual, -0.3);",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "import { strictEqual as equal } from 'node:assert'; equal(actual, 1e-1);",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "import { expect as verify } from '@jest/globals'; verify(0.6).not.toStrictEqual(actual);",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "import { expect } from 'bun:test'; expect(actual).toEqual(3 / 10);",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "const value = 0.3; const alias = value; compare(alias === actual);",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "compare(actual == +(0.4)); compare(actual != -0.6);",
				errors: [{ messageId: "exactFloatComparison" }, { messageId: "exactFloatComparison" }],
			},
			{
				code: "compare(actual < 0.7 || actual > 0.7);",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "compare(actual === -1 / 3);",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "compare(actual === +1 / 3);",
				errors: [{ messageId: "exactFloatComparison" }],
			},
			{
				code: "import { 'expect' as verify } from 'vitest'; verify(actual).toBe(0.2);",
				errors: [{ messageId: "exactFloatComparison" }],
			},
		],
		valid: [
			{
				code: "if (attempts === 3) retry();",
				documentation: { id: "pass", title: "Exact integer comparison" },
			},
			"const isHalf = scale === 0.5;",
			"const whole = result === 25 * 1.2;",
			"let estimate = 0.2; estimate === target;",
			"Math.abs(received - 0.2) < Number.EPSILON;",
			"function expect(value: number) { return { toBe(expected: number) {} }; } expect(score()).toBe(0.2);",
			"import { expect } from 'vitest'; expect(score()).toBeCloseTo(0.2);",
			"const exactExponent = value === 5e-1; const zero = value === 0.000;",
			"const integers = result === (2 + 3) * 4 - 5 ** 2 % 3;",
			"const bitwise = result === (1 | 2);",
			"const subtraction = result === 5 - 2; const moduloZero = result === 1 % 0;",
			"const exactDivision = result === 3 / 8; const zeroDivision = result === 1 / 0;",
			"const unknownDivision = result === +value / 3;",
			"let mutable = 0.2; const alias = mutable; compare(alias === actual);",
			"const recursive = recursive; compare(recursive === actual);",
			"const text = '0.2'; compare(text === actual);",
			"import assert from 'node:assert'; assert.ok(actual); assert.strictEqual(...values);",
			"import { equal } from 'assert'; equal(actual, 0.2);",
			"import { strictEqual } from 'assert'; strictEqual(...values);",
			"import { expect } from 'vitest'; expect(...values).toBe(0.2); expect(actual).toBe(...values);",
			"compare(actual <= 0.2 || actual >= 0.2); compare(actual < 0.2 && actual > 0.2);",
			"compare(actual < 0.2 || other > 0.2);",
			"compare(flag && actual > 0.2);",
			"switch (value) { default: consume(value); }",
			"class Example { #value; check(object: Example) { const present = #value in object; return present === false; } }",
		],
	});
});
