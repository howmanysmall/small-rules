import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import preferSharedStringConstant, { createPreferSharedStringConstantRule } from "./prefer-shared-string-constant";
import { indexUtilities } from "./utilities-index";

const SPECIFIER = "$oxc-utilities/react-utilities";

const index = indexUtilities([
	{
		filename: "react-utilities.ts",
		source: ['export const ROBLOX_TS = "roblox-ts";', 'export const STANDARD = "standard";'].join("\n"),
		specifier: SPECIFIER,
	},
]);

const rule = createPreferSharedStringConstantRule(() => index);

const ROBLOX_TS_ERROR = {
	data: { constant: "ROBLOX_TS", specifier: SPECIFIER, value: "roblox-ts" },
	messageId: "useConstant",
};

describe("prefer-shared-string-constant", () => {
	ts.run("prefer-shared-string-constant", rule, {
		invalid: [
			{
				code: 'if (options.environment === "roblox-ts") {}',
				output: [
					'import { ROBLOX_TS } from "$oxc-utilities/react-utilities";',
					"if (options.environment === ROBLOX_TS) {}",
				].join("\n"),
				errors: [ROBLOX_TS_ERROR],
			},
			{
				code: 'switch (environment) { case "standard": break; default: break; }',
				output: [
					'import { STANDARD } from "$oxc-utilities/react-utilities";',
					"switch (environment) { case STANDARD: break; default: break; }",
				].join("\n"),
				errors: [
					{
						data: { constant: "STANDARD", specifier: SPECIFIER, value: "standard" },
						messageId: "useConstant",
					},
				],
			},
			{
				code: 'const ENVIRONMENTS = ["roblox-ts", "luau"];',
				output: [
					'import { ROBLOX_TS } from "$oxc-utilities/react-utilities";',
					'const ENVIRONMENTS = [ROBLOX_TS, "luau"];',
				].join("\n"),
				errors: [ROBLOX_TS_ERROR],
			},
			{
				code: [
					'import { STANDARD } from "$oxc-utilities/react-utilities";',
					'if (options.environment === "roblox-ts") {}',
				].join("\n"),
				output: [
					'import { STANDARD, ROBLOX_TS } from "$oxc-utilities/react-utilities";',
					"if (options.environment === ROBLOX_TS) {}",
				].join("\n"),
				errors: [ROBLOX_TS_ERROR],
			},
			{
				code: [
					'import { ROBLOX_TS } from "$oxc-utilities/react-utilities";',
					'if (options.environment === "roblox-ts") {}',
				].join("\n"),
				output: [
					'import { ROBLOX_TS } from "$oxc-utilities/react-utilities";',
					"if (options.environment === ROBLOX_TS) {}",
				].join("\n"),
				errors: [ROBLOX_TS_ERROR],
			},
			{
				code: [
					'import type { ReactOptions } from "$oxc-utilities/react-utilities";',
					'import * as reactUtilities from "$oxc-utilities/react-utilities";',
					'if (options.environment === "roblox-ts") {}',
				].join("\n"),
				output: [
					'import type { ReactOptions } from "$oxc-utilities/react-utilities";',
					'import * as reactUtilities from "$oxc-utilities/react-utilities";',
					'import { ROBLOX_TS } from "$oxc-utilities/react-utilities";',
					"if (options.environment === ROBLOX_TS) {}",
				].join("\n"),
				errors: [ROBLOX_TS_ERROR],
			},
			{
				code: [
					'import { "ROBLOX_TS" as ROBLOX_TS } from "$oxc-utilities/react-utilities";',
					'if (options.environment === "roblox-ts") {}',
				].join("\n"),
				output: [
					'import { "ROBLOX_TS" as ROBLOX_TS } from "$oxc-utilities/react-utilities";',
					"if (options.environment === ROBLOX_TS) {}",
				].join("\n"),
				errors: [ROBLOX_TS_ERROR],
			},
			{
				code: ['const ROBLOX_TS = "something else";', 'if (options.environment === "roblox-ts") {}'].join("\n"),
				output: null,
				errors: [ROBLOX_TS_ERROR],
			},
			{
				filename: "react-utilities.ts",
				code: ['export const ROBLOX_TS = "roblox-ts";', 'if (options.environment === "roblox-ts") {}'].join(
					"\n",
				),
				output: ['export const ROBLOX_TS = "roblox-ts";', "if (options.environment === ROBLOX_TS) {}"].join(
					"\n",
				),
				errors: [ROBLOX_TS_ERROR],
			},
			{
				code: ['if (options.environment === "roblox-ts") {}', 'import { other } from "other";'].join("\n"),
				output: null,
				errors: [ROBLOX_TS_ERROR],
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
