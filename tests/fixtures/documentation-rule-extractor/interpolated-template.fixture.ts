import { ts } from "../../rule-testers";

declare const name: string;
declare const rule: unknown;

ts.run("interpolated-template", rule, {
	invalid: [
		{
			code: `const value = ${name};`,
			documentation: { id: "fail", title: "Interpolated" },
			errors: [{ messageId: "interpolated" }],
		},
	],
	valid: [],
});
