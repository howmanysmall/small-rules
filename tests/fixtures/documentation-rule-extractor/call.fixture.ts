import { ts } from "../../rule-testers";

declare const createCode: () => string;
declare const rule: unknown;

ts.run("call", rule, {
	invalid: [
		{
			code: createCode(),
			documentation: { id: "fail", title: "Call" },
			errors: [{ messageId: "call" }],
		},
	],
	valid: [],
});
