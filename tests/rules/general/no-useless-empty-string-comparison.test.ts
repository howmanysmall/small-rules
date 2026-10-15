import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/general/no-useless-empty-string-comparison";

describe("no-useless-empty-string-comparison", () => {
	ts.run("no-useless-empty-string-comparison", rule, {
		invalid: [
			{
				code: "if (value === '') flag = true;",
				errors: [{ data: { replacement: "!value" }, messageId: "emptyStringComparison" }],
				documentation: { id: "fail-strict-equality", title: "Strict equality against an empty string" },
			},
			{
				code: "if ('' === value) flag = true;",
				errors: [{ data: { replacement: "!value" }, messageId: "emptyStringComparison" }],
				documentation: { id: "fail-yoda", title: "The literal on the left is reported too" },
			},
			{
				code: "if (value == '') flag = true;",
				errors: [{ data: { replacement: "!value" }, messageId: "emptyStringComparison" }],
			},
			{
				code: "if (value !== '') flag = true;",
				errors: [{ data: { replacement: "value" }, messageId: "emptyStringComparison" }],
				documentation: { id: "fail-inequality", title: "Inequality suggests the truthy form" },
			},
			{
				code: "if (value != '') flag = true;",
				errors: [{ data: { replacement: "value" }, messageId: "emptyStringComparison" }],
			},
			{
				code: "if (value.trim() === '') flag = true;",
				errors: [{ data: { replacement: "!value.trim()" }, messageId: "emptyStringComparison" }],
				documentation: { id: "fail-trim", title: "Trimmed comparison" },
			},
			{
				code: "const a = '' === value; const b = value === '';",
				errors: [{ messageId: "emptyStringComparison" }, { messageId: "emptyStringComparison" }],
			},
			{
				code: "if (a === '' && b === 'hello') flag = true;",
				errors: [{ messageId: "emptyStringComparison" }],
			},
		],
		valid: [
			{
				code: "if (!value) flag = true;",
				documentation: { id: "pass-falsy", title: "Falsy check" },
			},
			{
				code: "if (value.trim()) submit(value);",
				documentation: { id: "pass-truthy-trim", title: "Truthy check on the trimmed value" },
			},
			{
				code: "if (value === 'hello') flag = true;",
				documentation: { id: "pass-non-empty", title: "Comparison against a non-empty string" },
			},
			{
				code: "if (value === undefined) flag = true;",
				documentation: { id: "pass-undefined", title: "Distinguishing undefined from empty" },
			},
			"if (value === '0') flag = true;",
			"if (value < '') flag = true;",
			"if (count === 0) flag = true;",
			"if (a === b) flag = true;",
			"if (a === null) flag = true;",
			"if (value.length === 0) flag = true;",
			"if (value === `not empty`) flag = true;",
			"if (value === String()) flag = true;",
		],
	});
});
