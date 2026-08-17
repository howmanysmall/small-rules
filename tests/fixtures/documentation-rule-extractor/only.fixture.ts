import { ts } from "../../rule-testers";

declare const rule: unknown;

ts.run("only", rule, {
	invalid: [
		{
			code: "const invalid = true;",
			errors: [{ messageId: "only" }],
			documentation: { id: "fail", title: "Focused" },
			only: true,
		},
	],
	valid: [],
});
