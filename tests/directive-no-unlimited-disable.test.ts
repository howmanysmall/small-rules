import { describe } from "vitest";
import rule from "$oxc-rules/directive-no-unlimited-disable";

import { js } from "./rule-testers";

describe("directive-no-unlimited-disable", () => {
	// @ts-expect-error -- Shut up
	js.run("directive-no-unlimited-disable", rule, {
		invalid: [
			{
				code: "/* oxlint-disable */\nconst x = 1;",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "const x = 1;\n// oxlint-disable-line",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "const x = 1;\n// oxlint-disable-next-line",
				errors: [{ messageId: "unexpected" }],
			},
		],
		valid: [
			{
				code: "// regular comment\nconst x = 1;",
			},
			{
				code: "/* oxlint-disable no-console */\nconst x = 1;\n/* oxlint-enable no-console */",
			},
			{
				code: "const x = 1;\n// oxlint-disable-line no-console",
			},
			{
				code: "const x = 1;\n// oxlint-disable-next-line no-console",
			},
		],
	});
});
