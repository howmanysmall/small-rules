import { ts } from "../../rule-testers";

declare const rule: unknown;

ts.run("static-values", rule, {
	invalid: [
		{
			code: String.raw`const raw = \`value\`;`,
			errors: [
				{
					messageId: "raw",
					suggestions: [{ messageId: "replaceRaw", output: "const raw = 'value';" }],
				},
			],
			documentation: { id: "raw", title: "Raw template" },
		},
		{
			code: "const value = 1;",
			errors: [{ messageId: "literal" }],
			documentation: { id: "literal", title: "String literal" },
		},
		{
			code: ["const", "value = 1;"].join("\n"),
			output: ["const", "value = 2;"].join("\n"),
			errors: [{ messageId: "joined" }, { message: "A second diagnostic" }],
			documentation: { id: "joined", title: "Joined source" },
		},
	],
	valid: [
		{
			filename: "example.ts",
			code: `const valid = true;`,
			// eslint-disable-next-line unicorn/no-null -- Verifies static null extraction.
			options: [{ enabled: true, limit: 2, nothing: null, values: ["first", "second"] }],
			documentation: { id: "template", title: "Template literal" },
			language: "ts",
			settings: { feature: { enabled: true } },
			sourceType: "script",
		},
	],
});
