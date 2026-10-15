import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/general/no-useless-empty-string-comparison";

describe("no-useless-empty-string-comparison", () => {
	ts.run("no-useless-empty-string-comparison", rule, {
		invalid: [
			{
				code: "if (value === '') flag = true;",
				output: "if (value.length === 0) flag = true;",
				errors: [{ data: { replacement: "value.length === 0" }, messageId: "useLengthComparison" }],
				documentation: { id: "fail-strict-equality", title: "Strict equality against an empty string" },
			},
			{
				code: "if ('' === value) flag = true;",
				output: "if (value.length === 0) flag = true;",
				errors: [{ messageId: "useLengthComparison" }],
				documentation: { id: "fail-yoda", title: "The literal on the left is reported too" },
			},
			{
				code: "if (value !== '') flag = true;",
				output: "if (value.length !== 0) flag = true;",
				errors: [{ messageId: "useLengthComparison" }],
				documentation: { id: "fail-inequality", title: "Inequality keeps its operator" },
			},
			{
				code: "if (value == '') flag = true;",
				output: "if (value.length == 0) flag = true;",
				errors: [{ messageId: "useLengthComparison" }],
			},
			{
				code: "if (value.trim() === '') flag = true;",
				output: "if (value.trim().length === 0) flag = true;",
				errors: [{ messageId: "useLengthComparison" }],
				documentation: { id: "fail-trim", title: "Trimmed comparison" },
			},
			{
				code: "if ((a || b) === '') flag = true;",
				output: "if ((a || b).length === 0) flag = true;",
				errors: [{ messageId: "useLengthComparison" }],
				documentation: { id: "fail-parenthesized", title: "Compound operands stay parenthesized" },
			},
			{
				code: "if ((value as string) === '') flag = true;",
				output: "if ((value as string).length === 0) flag = true;",
				errors: [{ messageId: "useLengthComparison" }],
			},
			{
				code: "if ((await load()) === '') flag = true;",
				output: "if ((await load()).length === 0) flag = true;",
				errors: [{ messageId: "useLengthComparison" }],
			},
			{
				code: "if (a === '' && b === 'hello') flag = true;",
				output: "if (a.length === 0 && b === 'hello') flag = true;",
				errors: [{ messageId: "useLengthComparison" }],
			},
		],
		valid: [
			{
				code: "if (value.length === 0) flag = true;",
				documentation: { id: "pass-length", title: "Length comparison" },
			},
			{
				code: "if (value === 'hello') flag = true;",
				documentation: { id: "pass-non-empty", title: "Comparison against a non-empty string" },
			},
			"if (value > '') flag = true;",
			"if (count === 0) flag = true;",
			"if (value === ``) flag = true;",
			"if (value === String()) flag = true;",
		],
	});
});
