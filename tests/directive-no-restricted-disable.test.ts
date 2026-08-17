import { describe } from "vitest";
import rule from "$oxc-rules/general/directive-no-restricted-disable";

import { js } from "./rule-testers";

describe("directive-no-restricted-disable", () => {
	js.run("directive-no-restricted-disable", rule, {
		invalid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				options: ["no-console"],
				errors: [{ messageId: "disallow" }],
				documentation: { id: "fail", title: "Restricted rule disable" },
			},
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				options: ["no-*"],
				errors: [{ messageId: "disallow" }],
			},
			{
				code: "/* oxlint-disable */\nconst x = 1;",
				options: ["no-console"],
				errors: [{ messageId: "disallow" }],
			},
		],
		valid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-enable no-console */",
			},
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				options: ["no-alert"],
				documentation: { id: "pass", title: "Non-restricted rule disable" },
			},
		],
	});
});
