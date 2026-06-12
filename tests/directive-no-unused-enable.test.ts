import { describe } from "vitest";
import rule from "$oxc-rules/directive-no-unused-enable";

import { js } from "./rule-testers";

describe("directive-no-unused-enable", () => {
	// @ts-expect-error -- Shut up
	js.run("directive-no-unused-enable", rule, {
		invalid: [
			{
				code: "/* oxlint-enable no-console */\nconst x = 1;",
				errors: [{ messageId: "unusedRule" }],
			},
			{
				code: "/* oxlint-enable */\nconst x = 1;",
				errors: [{ messageId: "unused" }],
			},
		],
		valid: [
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-enable no-console */",
			},
		],
	});
});
