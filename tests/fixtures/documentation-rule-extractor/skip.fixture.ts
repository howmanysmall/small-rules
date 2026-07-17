import { ts } from "../../rule-testers";

declare const rule: unknown;

ts.run("skip", rule, {
	invalid: [
		{
			code: "const invalid = true;",
			documentation: { id: "fail", title: "Skipped" },
			errors: [{ messageId: "skip" }],
			skip: true,
		},
	],
	valid: [],
});
