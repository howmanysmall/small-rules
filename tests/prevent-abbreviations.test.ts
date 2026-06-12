import { describe } from "vitest";
import rule from "$oxc-rules/prevent-abbreviations";

import { ts } from "./rule-testers";

const TEST_IGNORE_PATTERN = /^test/u;

describe("prevent-abbreviations", () => {
	// @ts-expect-error -- this thing is dumb.
	ts.run("prevent-abbreviations", rule, {
		invalid: [
			// Variable declaration with abbreviation (const)
			{
				code: "const err = new Error();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "const error = new Error();",
			},
			// Default shorthand replacement takes priority
			{
				code: "let args = [1, 2, 3];",
				errors: [
					{
						data: { discouragedName: "args", nameTypeText: "variable", replacement: "parameters" },
						messageId: "replace",
					},
				],
				output: "let parameters = [1, 2, 3];",
			},
			{
				code: "const plr = getPlayer();",
				errors: [{ messageId: "replace" }],
				output: "const player = getPlayer();",
			},
			{
				code: "const plr = Players.LocalPlayer;",
				errors: [
					{
						data: { discouragedName: "plr", nameTypeText: "variable", replacement: "localPlayer" },
						messageId: "replace",
					},
				],
				output: "const localPlayer = Players.LocalPlayer;",
			},
			{
				code: "const dt = 0.016;",
				errors: [
					{
						data: { discouragedName: "dt", nameTypeText: "variable", replacement: "deltaTime" },
						messageId: "replace",
					},
				],
				output: "const deltaTime = 0.016;",
			},
			{
				code: "const char = getCharacter();",
				errors: [{ messageId: "replace" }],
				output: "const character = getCharacter();",
			},
			// Variable declaration with abbreviation (var)
			{
				code: "var dist = 10;",
				errors: [
					{
						data: { discouragedName: "dist", nameTypeText: "variable", replacement: "distance" },
						messageId: "replace",
					},
				],
				output: "var distance = 10;",
			},
			// Function parameter with abbreviation
			{
				code: "function foo(err) { return err; }",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "function foo(error) { return error; }",
			},
			{
				code: "function foo(plr) { return plr; }",
				errors: [{ messageId: "replace" }],
				output: "function foo(player) { return player; }",
			},
			{
				code: "const { plr } = obj;",
				errors: [{ messageId: "replace" }],
				output: "const { plr: player } = obj;",
			},
			// Property name with abbreviation (when checkProperties: true)
			{
				code: "const obj = { err: 'value' };",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true }],
				output: "const obj = { error: 'value' };",
			},
			// Multiple replacement suggestions (no auto-fix)
			{
				code: "const fn = () => {};",
				errors: [
					{
						data: {
							discouragedName: "fn",
							nameTypeText: "variable",
							replacementsText: "`func`, `function`",
						},
						messageId: "suggestion",
					},
				],
			},
			{
				code: "const res = value;",
				errors: [
					{
						data: {
							discouragedName: "res",
							nameTypeText: "variable",
							replacementsText: "`resource`, `response`, `result`",
						},
						messageId: "suggestion",
					},
				],
				options: [{ replacements: { res: { resource: true, response: true, result: true } } }],
			},
			{
				code: "const Res = value;",
				errors: [
					{
						data: {
							discouragedName: "Res",
							nameTypeText: "variable",
							replacementsText: "`Resource`, `Response`, `Result`",
						},
						messageId: "suggestion",
					},
				],
				options: [{ replacements: { res: { resource: true, response: true, result: true } } }],
			},
			// Custom replacements
			{
				code: "const custom = 'test';",
				errors: [
					{
						data: { discouragedName: "custom", nameTypeText: "variable", replacement: "customReplacement" },
						messageId: "replace",
					},
				],
				options: [{ replacements: { custom: { customReplacement: true } } }],
				output: "const customReplacement = 'test';",
			},
			// Custom shorthand replacement
			{
				code: "const result = obj.fr;",
				errors: [
					{
						data: { discouragedName: "fr", nameTypeText: "property", replacement: "fullResult" },
						messageId: "replace",
					},
				],
				options: [{ checkShorthandProperties: true, shorthands: { fr: "fullResult" } }],
			},
			{
				code: "interface UnitBoxBadgeInfoProps {}",
				errors: [
					{
						data: {
							discouragedName: "UnitBoxBadgeInfoProps",
							nameTypeText: "variable",
							replacement: "UnitBoxBadgeInfoProperties",
						},
						messageId: "replace",
					},
				],
				options: [{ shorthands: { Props: "Properties" } }],
				output: "interface UnitBoxBadgeInfoProperties {}",
			},
			{
				code: "const myBtnClick = () => {};",
				errors: [
					{
						data: {
							discouragedName: "myBtnClick",
							nameTypeText: "variable",
							replacement: "myButtonClick",
						},
						messageId: "replace",
					},
				],
				options: [{ shorthands: { "*Btn*": "*Button*" } }],
				output: "const myButtonClick = () => {};",
			},
			{
				code: "const GEM_PANEL_FRAME_PROPS = {};",
				errors: [
					{
						data: {
							discouragedName: "GEM_PANEL_FRAME_PROPS",
							nameTypeText: "variable",
							replacement: "GEM_PANEL_FRAME_PROPERTIES",
						},
						messageId: "replace",
					},
				],
				options: [{ shorthands: { "*PROPS": "*PROPERTIES" } }],
				output: "const GEM_PANEL_FRAME_PROPERTIES = {};",
			},
			{
				code: "const TEXT_LABEL_TXT_GRAD_N_PROPS_2 = {};",
				errors: [
					{
						data: {
							discouragedName: "TEXT_LABEL_TXT_GRAD_N_PROPS_2",
							nameTypeText: "variable",
							replacement: "TEXT_LABEL_TXT_GRAD_N_PROPERTIES_2",
						},
						messageId: "replace",
					},
				],
				options: [{ shorthands: { "*PROPS": "*PROPERTIES" } }],
				output: "const TEXT_LABEL_TXT_GRAD_N_PROPERTIES_2 = {};",
			},
			{
				code: "const strName = '';",
				errors: [
					{
						data: { discouragedName: "strName", nameTypeText: "variable", replacement: "stringName" },
						messageId: "replace",
					},
				],
				options: [{ shorthands: { "/^str(.*)$/": "string$1" } }],
				output: "const stringName = '';",
			},
			// CamelCase word splitting
			{
				code: "const myErr = new Error();",
				errors: [
					{
						data: { discouragedName: "myErr", nameTypeText: "variable", replacement: "myError" },
						messageId: "replace",
					},
				],
				output: "const myError = new Error();",
			},
			{
				code: "const value = 1;",
				errors: [
					{
						data: { discouragedName: "err.ts", nameTypeText: "filename", replacement: "error.ts" },
						messageId: "replace",
					},
				],
				filename: "src/err.ts",
				options: [{ checkFilenames: true }],
			},
			{
				code: 'import err from "./module";',
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkDefaultAndNamespaceImports: true }],
				output: 'import error from "./module";',
			},
			{
				code: 'import * as args from "./module";',
				errors: [
					{
						data: { discouragedName: "args", nameTypeText: "variable", replacement: "parameters" },
						messageId: "replace",
					},
				],
				options: [{ checkDefaultAndNamespaceImports: "internal" }],
				output: 'import * as parameters from "./module";',
			},
			{
				code: 'import { err } from "./module";',
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkShorthandImports: true }],
				output: 'import { err as error } from "./module";',
			},
		],
		valid: [
			// CONSTANTS (all caps) should be ignored
			{
				code: "const ERR = 'error';",
			},
			{
				code: "const GEM_PANEL_FRAME = {};",
				options: [{ shorthands: { "*PROPS": "*PROPERTIES" } }],
			},
			// AllowList entries bypass detection
			{
				code: "const err = new Error();",
				options: [{ allowList: { err: true } }],
			},
			// Ignore patterns (regex)
			{
				code: "const testErr = new Error();",
				options: [{ ignore: [TEST_IGNORE_PATTERN] }],
			},
			// Ignore patterns (string)
			{
				code: "const testErr = new Error();",
				options: [{ ignore: ["testErr"] }],
			},
			// Property names not checked by default
			{
				code: "const obj = { err: 'value' };",
			},
			// Variables not checked when checkVariables: false
			{
				code: "const err = new Error();",
				options: [{ checkVariables: false }],
			},
			// Properties not checked when checkProperties: false (default)
			{
				code: "const obj = { err: 'value' };",
				options: [{ checkProperties: false }],
			},
			// Valid full names
			{
				code: "const error = new Error();",
			},
			{
				code: "const arguments = [1, 2, 3];",
			},
			{
				code: "const parameters = [1, 2, 3];",
			},
			{
				code: "const distance = 10;",
			},
			// Function with valid parameter name
			{
				code: "function foo(error) { return error; }",
			},
			// Property with valid name when checkProperties: true
			{
				code: "const obj = { error: 'value' };",
				options: [{ checkProperties: true }],
			},
			// Default shorthand property access remains allowed
			{
				code: "const model = entity.char;",
				options: [{ checkProperties: true, checkShorthandProperties: true }],
			},
			{
				code: "const x = container.plr;",
				options: [{ allowPropertyAccess: ["plr"] }],
			},
			{
				code: "const PropsWithoutRef = {};",
				options: [{ ignoreShorthands: ["Props"], shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: "type X = React.PropsWithoutRef<P>;",
				options: [{ allowPropertyAccess: ["PropsWithoutRef"], shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: 'import { InstanceProps } from "@rbxts/react";',
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: 'import type { InstanceProps } from "@rbxts/react";',
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: "const result = obj.fr;",
				options: [{ checkShorthandProperties: false, shorthands: { fr: "fullResult" } }],
			},
			{
				code: 'import err from "node_modules/package";',
				options: [{ checkDefaultAndNamespaceImports: "internal" }],
			},
			{
				code: 'import { err } from "node_modules/package";',
				options: [{ checkShorthandImports: "internal" }],
			},
			{
				code: 'const err = require("node_modules/package");',
				options: [{ checkDefaultAndNamespaceImports: "internal" }],
			},
		],
	});
});
