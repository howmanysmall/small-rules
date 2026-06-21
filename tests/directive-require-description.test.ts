import { describe } from "vitest";
import rule from "$oxc-rules/directive-require-description";

import { js, ts } from "./rule-testers";

describe("directive-require-description", () => {
	// @ts-expect-error -- RuleTester.run() type mismatch
	ts.run("directive-require-description (typescript)", rule, {
		invalid: [
			{
				code: "/* oxlint-disable typescript/no-explicit-any */\nexport type Value = any;\n",
				errors: [{ data: { kind: "oxlint-disable" }, messageId: "missingDescription" }],
				filename: "index.d.ts",
			},
		],
		valid: [
			{
				code: "/* oxlint-disable typescript/no-explicit-any -- legacy API surface */\nexport type Value = any;\n",
				filename: "index.d.ts",
			},
		],
	});

	// @ts-expect-error -- RuleTester.run() type mismatch
	js.run("directive-require-description (javascript)", rule, {
		invalid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				errors: [{ data: { kind: "oxlint-disable" }, messageId: "missingDescription" }],
			},
			{
				code: "// oxlint-disable small-rules/prefer-pascal-case-enums\nconst x = 1;",
				errors: [{ data: { kind: "oxlint-disable" }, messageId: "missingDescription" }],
			},
			{
				code: "// oxlint-disable-next-line no-console\nconsole.log('x');",
				errors: [{ data: { kind: "oxlint-disable-next-line" }, messageId: "missingDescription" }],
			},
			{
				code: "console.log('x');\n// oxlint-disable-line no-console",
				errors: [{ data: { kind: "oxlint-disable-line" }, messageId: "missingDescription" }],
			},
			{
				code: "/* eslint-enable no-console */\nconst x = 1;",
				errors: [{ data: { kind: "eslint-enable" }, messageId: "missingDescription" }],
			},
			{
				code: "// oxlint-enable no-console\nconst x = 1;",
				errors: [{ data: { kind: "oxlint-enable" }, messageId: "missingDescription" }],
			},
		],
		valid: [
			{
				code: "// regular comment",
			},
			{
				code: "/* regular block comment */",
			},
			{
				code: "/* oxlint-disable no-console -- need for debugging */\nconst x = 1;",
			},
			{
				code: "const x = 1;\n// oxlint-disable-line no-console -- temp",
			},
			{
				code: "// oxlint-enable no-console -- finished migration\nconst x = 1;",
			},
			{
				code: "// oxlint-disable-next-line no-console -- temporary bridge\nconsole.log('x');",
			},
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				options: [{ ignore: ["oxlint-disable"] }],
			},
			{
				code: "// oxlint-enable no-console\nconst x = 1;",
				options: [{ ignore: ["oxlint-enable"] }],
			},
			{
				code: "// eslint-disable no-console\nconst x = 1;",
			},
			{
				code: "/* global process */\nconsole.log(process.pid);",
			},
		],
	});
});
