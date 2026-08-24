import { describe } from "vitest";

import rule from "$oxc-rules/general/directive-no-unused-enable";

import { js } from "./rule-testers";

describe("directive-no-unused-enable", () => {
	js.run("directive-no-unused-enable", rule, {
		invalid: [
			{
				code: "/* oxlint-enable no-console */\nconst x = 1;",
				errors: [{ messageId: "unusedRule" }],
				documentation: { id: "fail", title: "Unused enable directive" },
			},
			{
				code: "/* oxlint-enable */\nconst x = 1;",
				errors: [{ messageId: "unused" }],
			},
		],
		valid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-enable no-console */",
				documentation: { id: "pass", title: "Matched disable and enable pair" },
			},
		],
	});
});
