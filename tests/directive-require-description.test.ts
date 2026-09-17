import { describe, expect, it } from "vitest";

import rule from "$oxc-rules/general/directive-require-description";

import { js, ts } from "./rule-testers";

import type { Comment, SourceCode } from "oxlint-plugin-utilities";

describe("directive-require-description", () => {
	ts.run("directive-require-description (typescript)", rule, {
		invalid: [
			{
				filename: "index.d.ts",
				code: "/* oxlint-disable typescript/no-explicit-any */\nexport type Value = any;\n",
				errors: [{ data: { kind: "oxlint-disable" }, messageId: "missingDescription" }],
			},
		],
		valid: [
			{
				filename: "index.d.ts",
				code: "/* oxlint-disable typescript/no-explicit-any -- legacy API surface */\nexport type Value = any;\n",
			},
		],
	});

	js.run("directive-require-description", rule, {
		invalid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				errors: [{ data: { kind: "oxlint-disable" }, messageId: "missingDescription" }],
				documentation: { id: "fail", title: "Missing directive description" },
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
				documentation: { id: "pass", title: "Described directive comment" },
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

	function createLineComment(): Comment {
		return {
			end: 18,
			loc: { end: { column: 18, line: 1 }, start: { column: 0, line: 1 } },
			range: [0, 18],
			start: 0,
			type: "Line",
			value: "oxlint-disable",
		};
	}

	it("should ignore line comments without string values", () => {
		expect.assertions(1);

		const lineComment = createLineComment();
		Object.assign(lineComment, { value: null });

		const stub = {
			getAllComments: (): Array<Comment> => [lineComment],
		} satisfies Pick<SourceCode, "getAllComments">;
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Test stub only provides getAllComments from SourceCode.
		const stubSourceCode = stub as SourceCode;
		const stubContext = {
			options: [],
			report: (): void => {
				throw new Error("Unexpected report for non-string comment value.");
			},
			sourceCode: stubSourceCode,
		};
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion, small-rules/no-chained-type-assertions -- Test stub only provides options, report, and sourceCode from Context.
		const context = stubContext as unknown as Parameters<typeof rule.create>[0];

		expect(() => rule.create(context)).not.toThrow();
	});
});
