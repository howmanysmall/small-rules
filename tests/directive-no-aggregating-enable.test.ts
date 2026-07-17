import { describe } from "vitest";
import rule from "$oxc-rules/directive-no-aggregating-enable";

import { js } from "./rule-testers";

describe("directive-no-aggregating-enable", () => {
	js.run("directive-no-aggregating-enable", rule, {
		invalid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-disable no-alert */\nconst y = 2;\n/* oxlint-enable no-console, no-alert */",
				documentation: { id: "fail", title: "Aggregated enable across rules" },
				errors: [{ messageId: "aggregatingEnable" }],
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
