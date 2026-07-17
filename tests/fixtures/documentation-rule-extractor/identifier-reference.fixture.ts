import { ts } from "../../rule-testers";

declare const rule: unknown;
declare const sharedCode: string;

ts.run("identifier-reference", rule, {
	invalid: [
		{
			code: sharedCode,
			documentation: { id: "fail", title: "Identifier" },
			errors: [{ messageId: "identifier" }],
		},
	],
	valid: [],
});
