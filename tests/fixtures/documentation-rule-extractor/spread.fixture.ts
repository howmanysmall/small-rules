import { ts } from "../../rule-testers";

declare const rule: unknown;
declare const sharedCase: object;

ts.run("spread", rule, {
	invalid: [
		{
			code: "const invalid = true;",
			documentation: { id: "fail", title: "Spread" },
			...sharedCase,
			errors: [{ messageId: "spread" }],
		},
	],
	valid: [],
});
