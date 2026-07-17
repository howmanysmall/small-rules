import { describe } from "vitest";
import rule from "$oxc-rules/directive-no-use";

import { js, tsx } from "./rule-testers";

describe("directive-no-use", () => {
	describe("block directives", () => {
		js.run("directive-no-use", rule, {
			invalid: [
				{
					code: "/* oxlint-disable no-console */\nconst x = 1;",
					documentation: { id: "fail", title: "Disallow block directive comments" },
					errors: [{ messageId: "disallow" }],
				},
			],
			valid: [
				{
					code: "/* oxlint-disable no-console */\nconst x = 1;",
					documentation: { id: "pass", title: "Allow configured directive comment" },
					options: [{ allow: ["oxlint-disable"] }],
				},
			],
		});
	});

	describe("line directives", () => {
		tsx.run("directive-no-use line directives", rule, {
			invalid: [],
			valid: [
				{
					code: "// oxlint-disable-next-line typescript/ban-ts-comment -- lol\n// @ts-nocheck\nexport const value = <div />;",
				},
			],
		});
	});
});
