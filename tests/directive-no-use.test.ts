import { describe } from "vitest";
import rule from "$oxc-rules/directive-no-use";

import { js, tsx } from "./rule-testers";

describe("directive-no-use", () => {
	describe("block directives", () => {
		// @ts-expect-error -- Shut up
		js.run("directive-no-use", rule, {
			invalid: [
				{
					code: "/* oxlint-disable no-console */\nconst x = 1;",
					errors: [{ messageId: "disallow" }],
				},
			],
			valid: [
				{
					code: "/* oxlint-disable no-console */\nconst x = 1;",
					options: [{ allow: ["oxlint-disable"] }],
				},
			],
		});
	});

	describe("line directives", () => {
		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
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
