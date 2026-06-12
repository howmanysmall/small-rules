import { describe } from "vitest";
import rule from "$oxc-rules/no-warn";

import { js } from "./rule-testers";

describe("no-warn", () => {
	// @ts-expect-error -- Shut up
	js.run("no-warn", rule, {
		invalid: [
			{
				code: "warn('Hello');",
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
			"Log.warn('Hello');",
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
