import { describe } from "vitest";
import rule from "$oxc-rules/no-warn";

import { js } from "./rule-testers";

describe("no-warn", () => {
	js.run("no-warn", rule, {
		invalid: [
			{
				code: "warn('Hello');",
				documentation: { id: "fail", title: "global warn call" },
				errors: [{ messageId: "noWarn" }],
			},
			{
				code: "warn(value);",
				errors: [{ messageId: "noWarn" }],
			},
			{
				code: "warn();",
				errors: [{ messageId: "noWarn" }],
			},
			{
				code: "warn('test', 'multiple', 'args');",
				errors: [{ messageId: "noWarn" }],
			},
			{
				code: "const x = warn(123);",
				errors: [{ messageId: "noWarn" }],
			},
			{
				code: "condition ? warn('yes') : warn('no');",
				errors: [{ messageId: "noWarn" }, { messageId: "noWarn" }],
			},
		],
		valid: [
			{
				code: "Log.warn('Hello');",
				documentation: { id: "pass", title: "logger warn call" },
			},
			"Log.Warning(value);",
			"console.log('test');",
			"const warn = 'string';",
			"const warnMessage = () => value;",
			"obj.warn();",
			"obj['warn']();",
			"warner();",
			"warning = true;",
		],
	});
});
