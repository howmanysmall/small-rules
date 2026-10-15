import { describe } from "vitest";
import { js } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/general/directive-no-aggregating-enable";

describe("directive-no-aggregating-enable", () => {
	js.run("directive-no-aggregating-enable", rule, {
		invalid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-disable no-alert */\nconst y = 2;\n/* oxlint-enable no-console, no-alert */",
				errors: [{ messageId: "aggregatingEnable" }],
				documentation: { id: "fail", title: "Aggregated enable across rules" },
			},
		],
		valid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-enable no-console */",
				documentation: { id: "pass", title: "Single rule disable and enable" },
			},
			{
				code: "/* oxlint-disable */\nconst x = 1;\n/* oxlint-enable */",
			},
		],
	});
});
