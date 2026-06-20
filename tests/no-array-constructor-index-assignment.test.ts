import { describe } from "vitest";
import rule from "$oxc-rules/no-array-constructor-index-assignment";

import { ts } from "./rule-testers";

describe("no-array-constructor-index-assignment", () => {
	// @ts-expect-error -- Shut up.
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
		],
		valid: [
			"const samples = [replacement];",
			"const values = new Array<number>();",
			"const values = new Array<number>(3);\nvalues[0] = 1;",
			"const values = new Array<number>();\nvalues[1] = 1;",
			"const values = new Array<number>();\nconsole.log(values);\nvalues[0] = 1;",
			"const values = new Array<number>();\nvalues.push(1);",
		],
	});
});
