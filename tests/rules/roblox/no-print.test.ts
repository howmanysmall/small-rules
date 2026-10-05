import { describe } from "vitest";
import { js } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/roblox/no-print";

describe("no-print", () => {
	js.run("no-print", rule, {
		invalid: [
			{
				code: "print('Hello');",
				errors: [{ messageId: "noPrint" }],
				documentation: { id: "fail", title: "global print call" },
			},
			{
				code: "print(value);",
				errors: [{ messageId: "noPrint" }],
			},
			{
				code: "print();",
				errors: [{ messageId: "noPrint" }],
			},
			{
				code: "print('test', 'multiple', 'args');",
				errors: [{ messageId: "noPrint" }],
			},
			{
				code: "const x = print(123);",
				errors: [{ messageId: "noPrint" }],
			},
			{
				code: "condition ? print('yes') : print('no');",
				errors: [{ messageId: "noPrint" }, { messageId: "noPrint" }],
			},
		],
		valid: [
			{
				code: "Log.info('Hello');",
				documentation: { id: "pass", title: "logger info call" },
			},
			"Log.debug(value);",
			"console.log('test');",
			"const print = 'string';",
			"const printMessage = () => value;",
			"obj.print();",
			"obj['print']();",
			"printer();",
			"printing = true;",
		],
	});
});
