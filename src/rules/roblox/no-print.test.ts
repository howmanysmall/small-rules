import { describe } from "vitest";
import { js, ts } from "@small-rules/rule-harness/rule-testers";

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
			// A local binding of the same name is not the global.
			'import { print } from "./log"; print("message");',
			"function run(print) { print('message'); }",
			"function print(message) { return message; } print('message');",
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

	// A type-only binding of the same name does not shadow the global.
	ts.run("no-print type bindings", rule, {
		invalid: [
			{ code: 'type print = string;\nprint("a");', errors: [{ messageId: "noPrint" }] },
			{ code: 'interface print {}\nprint("a");', errors: [{ messageId: "noPrint" }] },
		],
		valid: [],
	});
});
