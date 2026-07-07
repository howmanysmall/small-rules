import { describe } from "vitest";
import rule from "$oxc-rules/no-array-constructor-index-assignment";

import { ts } from "./rule-testers";

describe("no-array-constructor-index-assignment", () => {
	ts.run("no-array-constructor-index-assignment", rule, {
		invalid: [
			{
				code: "const samples = new Array<string>();\nsamples[0] = replacement;",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "const samples = [replacement];",
			},
			{
				code: "const samples = new Array<string>();\nconst other = compute();\nsamples[0] = other;",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "const other = compute();\nconst samples = [other];",
			},
			{
				code: "const values = new Array<number>();\nvalues[0] = 1;\nvalues[1] = 2;",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "const values = [1, 2];",
			},
			{
				code: "const values: Array<number> = new Array();\nvalues[0] = 1;\nvalues[1] = 2;",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "const values: Array<number> = [1, 2];",
			},
			{
				code: "const values: ReadonlyArray<number> = new Array();\nvalues[0] = 1;",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "const values: ReadonlyArray<number> = [1];",
			},
			{
				code: "let values = new Array<number>();\nvalues[0] = 1;\nvalues[1] = 2;",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "let values = [1, 2];",
			},
			{
				code: "function f() {\n  const values = new Array<number>();\n  values[0] = 1;\n  return values;\n}",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "function f() {\n  const values = [1];\n  return values;\n}",
			},
			{
				code: "const values = new Array<number>();\nconst other = compute();\nvalues[0] = other;\nconsole.log(values);",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "const other = compute();\nconst values = [other];\nconsole.log(values);",
			},
			{
				code: "const values = new Array<number>();\nvalues[0] = 1;\nvalues[0] = 2;",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "const values = [1];\nvalues[0] = 2;",
			},
			{
				code: "const values = new Array<number>();\nother[0] = 1;\nvalues[0] = other[0];",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "other[0] = 1;\nconst values = [other[0]];",
			},
			{
				code: "before();\nconst values = new Array<number>();\nsideEffect();\nvalues[0] = 1;",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "before();\nsideEffect();\nconst values = [1];",
			},
			{
				code: "const values = new Array<number>();\nconst pattern = /value/u;\nvalues[0] = 1;",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "const pattern = /value/u;\nconst values = [1];",
			},
			{
				code: "const values = new Array<number>();\rvalues[0] = 1;",
				errors: [{ messageId: "preferArrayLiteral" }],
				output: "const values = [1];\r",
			},
		],
		valid: [
			"const samples = [replacement];",
			"const values = new Array<number>();",
			"declare const values: Array<number>;",
			"const values = new Set<number>();\nvalues[0] = 1;",
			"function Array<T>() { return []; }\nconst values = new Array<number>();\nvalues[0] = 1;",
			"const values = new Array<number>(3);\nvalues[0] = 1;",
			"const [values] = new Array<number>();\nvalues[0] = 1;",
			"const values = new Array<number>();\nvalues[1] = 1;",
			"const values = new Array<number>();\nvalues[index] = 1;",
			"const values = new Array<number>();\nvalues = [];",
			"const values = new Array<number>();\nvalues[0] += 1;",
			"const values = new Array<number>();\nconsole.log(values);\nvalues[0] = 1;",
			"const values = new Array<number>();\nvalues.push(1);",
			"const values = new Array<number>();\nconst entries = [[values]];\nvalues[0] = 1;",
		],
	});
});
