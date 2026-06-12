import { describe } from "vitest";
import rule from "$oxc-rules/directive-no-restricted-disable";

import { js } from "./rule-testers";

describe("directive-no-restricted-disable", () => {
	// @ts-expect-error -- Shut up
	js.run("directive-no-restricted-disable", rule, {
		invalid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				errors: [{ messageId: "disallow" }],
				options: ["no-console"],
			},
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				errors: [{ messageId: "disallow" }],
				options: ["no-*"],
			},
		],
		valid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-enable no-console */",
			},
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				options: ["no-alert"],
			},
		],
	});
});
