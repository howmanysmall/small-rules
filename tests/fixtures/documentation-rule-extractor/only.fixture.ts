import { ts } from "../../rule-testers";

declare const rule: unknown;

ts.run("only", rule, {
	invalid: [
		{
			code: "const invalid = true;",
			documentation: { id: "fail", title: "Focused" },
			errors: [{ messageId: "only" }],
			only: true,
		},
	],
	valid: [],
});
