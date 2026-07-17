import { ts } from "../../rule-testers";

declare const rule: unknown;

ts.run("static-values", rule, {
	invalid: [
		{
			code: String.raw`const raw = \`value\`;`,
			documentation: { id: "raw", title: "Raw template" },
			errors: [
				{
					messageId: "raw",
					suggestions: [{ messageId: "replaceRaw", output: "const raw = 'value';" }],
				},
			],
		},
		{
			code: "const value = 1;",
			documentation: { id: "literal", title: "String literal" },
			errors: [{ messageId: "literal" }],
		},
		{
			code: ["const", "value = 1;"].join("\n"),
			documentation: { id: "joined", title: "Joined source" },
			errors: [{ messageId: "joined" }, { message: "A second diagnostic" }],
			output: ["const", "value = 2;"].join("\n"),
		},
	],
	valid: [
		{
			code: `const valid = true;`,
			documentation: { id: "template", title: "Template literal" },
			filename: "example.ts",
			language: "ts",
			// eslint-disable-next-line unicorn/no-null -- Verifies static null extraction.
			options: [{ enabled: true, limit: 2, nothing: null, values: ["first", "second"] }],
			settings: { feature: { enabled: true } },
			sourceType: "script",
		},
	],
});
