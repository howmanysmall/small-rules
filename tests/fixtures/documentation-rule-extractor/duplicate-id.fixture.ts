import { ts } from "../../rule-testers";

declare const rule: unknown;

ts.run("duplicate-id", rule, {
	invalid: [
		{
			code: "const invalid = true;",
			documentation: { id: "same", title: "Invalid" },
			errors: [{ messageId: "invalid" }],
		},
	],
	valid: [
		{
			code: "const valid = true;",
			documentation: { id: "same", title: "Valid" },
		},
	],
});
