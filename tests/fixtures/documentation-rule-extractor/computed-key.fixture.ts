import { ts } from "../../rule-testers";

declare const dynamicKey: string;
declare const rule: unknown;

ts.run("computed-key", rule, {
	invalid: [
		{
			code: "const invalid = true;",
			errors: [{ messageId: "computed" }],
			documentation: { id: "fail", title: "Computed key" },
			[dynamicKey]: "value",
		},
	],
	valid: [],
});
