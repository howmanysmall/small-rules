import { ts } from "../../rule-testers";

declare const formatCode: (value: string) => string;
declare const rule: unknown;
declare const sharedOptions: Record<string, unknown>;
declare const value: string;

ts.run("unmarked-unsupported", rule, {
	invalid: [
		{
			code: formatCode(value),
			options: [{ ...sharedOptions }],
			errors: [{ messageId: "dynamic" }],
		},
	],
	valid: [
		{
			code: "const valid = true;",
			documentation: { id: "pass", title: "Static case" },
		},
	],
});
