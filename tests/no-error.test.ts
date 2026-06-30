import { describe } from "vitest";
import rule from "$oxc-rules/no-error";

import { js } from "./rule-testers";

describe("no-error", () => {
	js.run("no-error", rule, {
		invalid: [
			{
				code: "error('Hello');",
				errors: [{ messageId: "noError" }],
			},
			{
				code: "error(value);",
				errors: [{ messageId: "noError" }],
			},
			{
				code: "error();",
				errors: [{ messageId: "noError" }],
			},
			{
				code: "error('test', 'multiple', 'args');",
				errors: [{ messageId: "noError" }],
			},
			{
				code: "const x = error(123);",
				errors: [{ messageId: "noError" }],
			},
			{
				code: "condition ? error('yes') : error('no');",
				errors: [{ messageId: "noError" }, { messageId: "noError" }],
			},
		],
		valid: [
			"Log.error('Hello');",
			"throw new Error('test');",
			"console.error('test');",
			"const error = 'string';",
			"const errorMessage = () => value;",
			"obj.error();",
			"obj['error']();",
			"errored();",
			"errorOccurred = true;",
		],
	});
});
