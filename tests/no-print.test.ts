import { describe } from "vitest";
import rule from "$oxc-rules/no-print";

import { js } from "./rule-testers";

describe("no-print", () => {
	// @ts-expect-error -- Shut up
	js.run("no-print", rule, {
		invalid: [
			{
				code: "print('Hello');",
				errors: [{ messageId: "noPrint" }],
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
			"Log.info('Hello');",
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
