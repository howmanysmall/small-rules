import { ts } from "../../rule-testers";

declare const rule: unknown;

ts.run("skip", rule, {
	invalid: [
		{
			code: "const invalid = true;",
			errors: [{ messageId: "skip" }],
			documentation: { id: "fail", title: "Skipped" },
			skip: true,
		},
	],
	valid: [],
});
