import { ts } from "../../rule-testers";

declare const dynamicKey: string;
declare const rule: unknown;

ts.run("computed-key", rule, {
	invalid: [
		{
			code: "const invalid = true;",
			documentation: { id: "fail", title: "Computed key" },
			[dynamicKey]: "value",
			errors: [{ messageId: "computed" }],
		},
	],
	valid: [],
});
