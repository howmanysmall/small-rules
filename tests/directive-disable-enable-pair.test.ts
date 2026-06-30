import { describe } from "vitest";
import rule from "$oxc-rules/directive-disable-enable-pair";

import { js } from "./rule-testers";

describe("directive-disable-enable-pair", () => {
	js.run("directive-disable-enable-pair", rule, {
		invalid: [
			{
				code: "const z = 0;\n/* oxlint-disable no-console */\nconst x = 1;",
				errors: [{ messageId: "missingRulePair" }],
			},
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-disable no-console */\nconst y = 2;",
				errors: [{ messageId: "missingRulePair" }, { messageId: "missingRulePair" }],
			},
			{
				code: "const x = 1;\n/* oxlint-disable no-console */\nconst y = 2;",
				errors: [{ messageId: "missingRulePair" }],
			},
			{
				code: "/* oxlint-disable */\nconst x = 1;",
				errors: [{ messageId: "missingPair" }],
			},
		],
		valid: [
			{
				code: "",
				options: [{ allowWholeFile: true }],
			},
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;",
				options: [{ allowWholeFile: true }],
			},
			{
				code: "// oxlint-disable no-console\nconst x = 1;",
				options: [{ allowWholeFile: true }],
			},
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-enable no-console */",
			},
			{
				code: "/* oxlint-disable */\nconst x = 1;\n/* oxlint-enable */",
			},
			{
				code: "const x = 1;\n// oxlint-disable-line no-console",
			},
			{
				code: "const x = 1;\n// oxlint-disable-next-line no-console\nconst y = 2;",
			},
		],
	});
});
