import { ts } from "../../rule-testers";

declare const name: string;
declare const rule: unknown;

ts.run("interpolated-template", rule, {
	invalid: [
		{
			code: `const value = ${name};`,
			errors: [{ messageId: "interpolated" }],
			documentation: { id: "fail", title: "Interpolated" },
		},
	],
	valid: [],
});
