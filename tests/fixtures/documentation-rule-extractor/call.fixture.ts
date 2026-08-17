import { ts } from "../../rule-testers";

declare const createCode: () => string;
declare const rule: unknown;

ts.run("call", rule, {
	invalid: [
		{
			code: createCode(),
			errors: [{ messageId: "call" }],
			documentation: { id: "fail", title: "Call" },
		},
	],
	valid: [],
});
