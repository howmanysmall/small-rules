import { describe } from "vitest";
import rule from "$oxc-rules/directive-no-duplicate-disable";

import { js } from "./rule-testers";

describe("directive-no-duplicate-disable", () => {
	js.run("directive-no-duplicate-disable", rule, {
		invalid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-disable no-console */",
				documentation: { id: "fail", title: "Duplicate rule disable directive" },
				errors: [{ messageId: "duplicateRule" }],
			},
			{
				code: "/* oxlint-disable */\nconst x = 1;\n/* oxlint-disable */",
				errors: [{ messageId: "duplicate" }],
			},
		],
		valid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-enable no-console */",
				documentation: { id: "pass", title: "Paired disable and enable" },
			},
			"/* oxlint-disable */\nconst x = 1;\n/* oxlint-enable */",
			"const x = 1;\n// oxlint-disable-line no-console",
		],
	});
});
