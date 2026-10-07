import { describe } from "vitest";
import { ts, tsx } from "@small-rules/rule-harness/rule-testers";

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
			'if (options.environment === "luau") {}',
			"if (options.environment === `roblox-ts`) {}",
			"switch (environment) { default: break; }",
			"const holes = [, 1];",
			'const environments = { "roblox-ts": 1, standard: 2 };',
			'import { roblox } from "roblox-ts";',
			'export * from "standard";',
			'const loaded = import("standard");',
			'type Environment = "roblox-ts" | "standard";',
			'enum Environment { Standard = "standard" }',
			'"standard";',
			{ filename: "react-utilities.ts", code: 'export const ROBLOX_TS = "roblox-ts" as const;' },
			{ code: 'const meta = { type: "standard" };', options: [{ ignoredProperties: ["type"] }] },
			{ code: 'const meta = { "type": "standard" };', options: [{ ignoredProperties: ["type"] }] },
			'class Environment { "standard" = 1; }',
		],
	});
});

describe("prefer-shared-string-constant in value positions", () => {
	ts.run("prefer-shared-string-constant", rule, {
		invalid: [
			{
				code: 'const options = { [kind]: "standard", 1: "roblox-ts" };',
				options: [{ ignoredProperties: ["type"] }],
				errors: [{ messageId: "useConstant" }, ROBLOX_TS_ERROR],
			},
			{
				code: 'const lookup = { ["standard"]: 1 };',
				errors: [{ messageId: "useConstant" }],
			},
			{
				code: 'const environment = isStandard ? "standard" : "roblox-ts";',
				output: [
					'import { STANDARD } from "$oxc-utilities/react-utilities";',
					'const environment = isStandard ? STANDARD : "roblox-ts";',
				].join("\n"),
				errors: [
					{
						data: { constant: "STANDARD", specifier: SPECIFIER, value: "standard" },
						messageId: "useConstant",
					},
					ROBLOX_TS_ERROR,
				],
			},
			{
				code: 'const options = { environment: "roblox-ts", type: "standard" };',
				errors: [ROBLOX_TS_ERROR, { messageId: "useConstant" }],
			},
			{
				code: 'const options = { environment: "roblox-ts", type: "standard" };',
				options: [{ ignoredProperties: ["type"] }],
				errors: [ROBLOX_TS_ERROR],
			},
			{
				code: 'function getEnvironment(environment = "roblox-ts") { return useEnvironment("standard"); }',
				errors: [ROBLOX_TS_ERROR, { messageId: "useConstant" }],
			},
			{
				code: 'const MODE = "roblox-ts";',
				errors: [ROBLOX_TS_ERROR],
			},
			{
				code: 'if (options.environment > "roblox-ts") {}',
				errors: [ROBLOX_TS_ERROR],
			},
		],
		valid: [],
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

describe("prefer-shared-string-constant in JSX", () => {
	tsx.run("prefer-shared-string-constant", rule, {
		invalid: [],
		valid: ['const element = <Frame environment="standard" />;'],
	});
});
