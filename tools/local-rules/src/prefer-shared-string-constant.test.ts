import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import preferSharedStringConstant, { createPreferSharedStringConstantRule } from "./prefer-shared-string-constant";
import { indexUtilities } from "./utilities-index";

const index = indexUtilities([
	{
		source: ['export const ROBLOX_TS = "roblox-ts";', 'export const STANDARD = "standard";'].join("\n"),
		specifier: "$oxc-utilities/react-utilities",
	},
]);

const rule = createPreferSharedStringConstantRule(() => index);

describe("prefer-shared-string-constant", () => {
	ts.run("prefer-shared-string-constant", rule, {
		invalid: [
			{
				code: 'if (options.environment === "roblox-ts") {}',
				errors: [
					{
						data: {
							constant: "ROBLOX_TS",
							specifier: "$oxc-utilities/react-utilities",
							value: "roblox-ts",
						},
						messageId: "useConstant",
					},
				],
			},
			{
				code: 'switch (environment) { case "standard": break; default: break; }',
				errors: [
					{
						data: { constant: "STANDARD", specifier: "$oxc-utilities/react-utilities", value: "standard" },
						messageId: "useConstant",
					},
				],
			},
			{
				code: 'const ENVIRONMENTS = ["roblox-ts", "luau"];',
				errors: [
					{
						data: {
							constant: "ROBLOX_TS",
							specifier: "$oxc-utilities/react-utilities",
							value: "roblox-ts",
						},
						messageId: "useConstant",
					},
				],
			},
		],
		valid: [
			"if (options.environment === ROBLOX_TS) {}",
			'const meta = { type: "standard" };',
			'if (options.environment === "luau") {}',
			'if (options.environment > "roblox-ts") {}',
			"if (options.environment === `roblox-ts`) {}",
			"switch (environment) { default: break; }",
			"const holes = [, 1];",
		],
	});
});

describe("prefer-shared-string-constant with the repository utilities", () => {
	ts.run("prefer-shared-string-constant", preferSharedStringConstant, {
		invalid: [
			{
				code: 'if (options.environment === "roblox-ts") {}',
				errors: [{ messageId: "useConstant" }],
			},
		],
		valid: ["if (options.environment === ROBLOX_TS) {}"],
	});
});
