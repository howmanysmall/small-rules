import { describe } from "vitest";
import rule from "$oxc-rules/directive-no-restricted-disable";

import { js } from "./rule-testers";

describe("directive-no-restricted-disable", () => {
	js.run("directive-no-restricted-disable", rule, {
		invalid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				documentation: { id: "fail", title: "Restricted rule disable" },
				errors: [{ messageId: "disallow" }],
				options: ["no-console"],
			},
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				errors: [{ messageId: "disallow" }],
				options: ["no-*"],
			},
			{
				code: "/* oxlint-disable */\nconst x = 1;",
				errors: [{ messageId: "disallow" }],
				options: ["no-console"],
			},
		],
		valid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-enable no-console */",
			},
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				documentation: { id: "pass", title: "Non-restricted rule disable" },
				options: ["no-alert"],
			},
		],
	});
});
