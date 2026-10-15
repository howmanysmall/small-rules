import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/general/no-useless-empty-string-comparison";

describe("no-useless-empty-string-comparison", () => {
	ts.run("no-useless-empty-string-comparison", rule, {
		invalid: [
			{
				code: "if (value === '') flag = true;",
				errors: [{ data: { replacement: "!value" }, messageId: "emptyStringComparison" }],
				documentation: { id: "fail", title: "Useless empty-string comparison" },
			},
			{
				code: "if ('' === value) flag = true;",
				errors: [{ data: { replacement: "!value" }, messageId: "emptyStringComparison" }],
			},
			{
				code: "if (value == '') flag = true;",
				errors: [{ data: { replacement: "!value" }, messageId: "emptyStringComparison" }],
			},
			{
				code: "if (value !== '') flag = true;",
				errors: [{ data: { replacement: "value" }, messageId: "emptyStringComparison" }],
			},
			{
				code: "if (value != '') flag = true;",
				errors: [{ data: { replacement: "value" }, messageId: "emptyStringComparison" }],
			},
			{
				code: "if (value.trim() === '') flag = true;",
				errors: [{ data: { replacement: "!value.trim()" }, messageId: "emptyStringComparison" }],
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
				code: "if (value === 'hello') flag = true;",
				documentation: { id: "pass", title: "Non-empty string comparison" },
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
