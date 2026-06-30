import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import rule from "$oxc-rules/prevent-abbreviations";
import {
	getMessage,
	getNameReplacements,
	getShorthandReplacement,
	isDiscouragedReplacementName,
	isPropertyAccessAllowed,
	isShorthandIgnored,
	prepareOptions,
} from "$oxc-utilities/prevent-abbreviations/replacements";

import { ts, tsx } from "./rule-testers";

const TEST_IGNORE_PATTERN = /^test/u;
const MANY_REPLACEMENTS = Object.fromEntries(
	Array.from({ length: 104 }, (_, index) => [`replacement${index.toString().padStart(3, "0")}`, true]),
);

describe("prevent-abbreviations", () => {
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
				code: "function foo(err = fallback) { return err; }",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "function foo(error = fallback) { return error; }",
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
				code: "const abbr = value;",
				errors: [
					{
						data: {
							discouragedName: "abbr",
							nameTypeText: "variable",
							replacementsText:
								"`replacement000`, `replacement001`, `replacement002`, ... (99+ more omitted)",
						},
						messageId: "suggestion",
					},
				],
				options: [{ replacements: { abbr: MANY_REPLACEMENTS } }],
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
				code: "getThing().fr;",
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
			{
				code: "const first = 1; const second = 2;",
				errors: [{ messageId: "replace" }, { messageId: "replace" }],
				options: [
					{
						replacements: {
							first: { value: true },
							second: { value: true },
						},
					},
				],
				output: "const value = 1; const value_ = 2;",
			},
			{
				code: "const target = 1; const source = 2;",
				errors: [
					{
						data: { discouragedName: "target", nameTypeText: "variable", replacement: "destination" },
						messageId: "replace",
					},
					{
						data: {
							discouragedName: "source",
							nameTypeText: "variable",
							replacementsText: "`target`",
						},
						messageId: "suggestion",
					},
				],
				options: [
					{
						extendDefaultReplacements: false,
						replacements: {
							source: { target: true },
							target: { destination: true },
						},
					},
				],
				output: "const destination = 1; const source = 2;",
			},
			{
				code: "let param;",
				errors: [
					{
						data: {
							discouragedName: "param",
							nameTypeText: "variable",
							replacementsText: "`arguments_`, `parameter`",
						},
						messageId: "suggestion",
					},
				],
				options: [{ replacements: { param: { arguments: true } } }],
			},
			{
				code: "const handler = (param) => param;",
				errors: [
					{
						data: {
							discouragedName: "param",
							nameTypeText: "variable",
							replacementsText: "`arguments_`, `parameter`",
						},
						messageId: "suggestion",
					},
				],
				options: [{ replacements: { param: { arguments: true } } }],
			},
			{
				code: "const { err = fallback } = payload;",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "const { err: error = fallback } = payload;",
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
			{
				code: "const err = 1; export { err };",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "const error = 1; export { error as err };",
			},
			{
				code: "export function err() {}",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: "export class Err {}",
				errors: [
					{
						data: { discouragedName: "Err", nameTypeText: "variable", replacement: "Error_" },
						messageId: "replace",
					},
				],
				options: [{ replacements: { err: { error: true } } }],
			},
			{
				code: "export type Err = string;",
				errors: [
					{
						data: { discouragedName: "Err", nameTypeText: "variable", replacement: "Error_" },
						messageId: "replace",
					},
				],
				options: [{ replacements: { err: { error: true } } }],
			},
			{
				code: "interface Shape { err: string }",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true }],
			},
			{
				code: "class Shape { err = 1 }",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true }],
			},
			{
				code: "const payload = { err: 1 };",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true }],
			},
			{
				code: "const err = value;",
				errors: [
					{
						messageId: "suggestion",
					},
				],
				options: [{ replacements: { err: { "bad-name": true } } }],
			},
			{
				code: 'import { default as err } from "./module";',
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkDefaultAndNamespaceImports: true }],
				output: 'import { default as error } from "./module";',
			},
			{
				code: 'const err = require("./module");',
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: 'const error = require("./module");',
			},
			{
				code: "target.err = 1;",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true }],
			},
			{
				code: "const value = 1;",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "filename", replacement: "error" },
						messageId: "replace",
					},
				],
				filename: "src/err",
				options: [{ checkFilenames: true }],
			},
			{
				code: "class Shape { err() {} }",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true }],
			},
			{
				code: "const { err: value } = payload;",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true }],
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
			{
				code: "const value = 1;",
				filename: "src/value.ts",
				options: [{ checkFilenames: true }],
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
			{
				code: "const obj = { __proto__: value };",
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
				code: "const ButtonProps = {};",
				options: [{ ignoreShorthands: ["*Props"], shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: "type X = React.PropsWithoutRef<P>;",
				options: [{ allowPropertyAccess: ["PropsWithoutRef"], shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: "type X = React.PropsWithoutRef<P>;",
				options: [{ allowPropertyAccess: ["Props"], shorthands: { "*Props": "*Properties" } }],
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
				code: "const result = obj.fr;",
				options: [{ ignoreShorthands: ["fr"], shorthands: { fr: "fullResult" } }],
			},
			{
				code: 'import err from "node_modules/package";',
				options: [{ checkDefaultAndNamespaceImports: "internal" }],
			},
			{
				code: 'import err from "./module";',
				options: [{ checkDefaultAndNamespaceImports: false }],
			},
			{
				code: 'import { err } from "node_modules/package";',
				options: [{ checkShorthandImports: "internal" }],
			},
			{
				code: 'const err = require("node_modules/package");',
				options: [{ checkDefaultAndNamespaceImports: "internal" }],
			},
			{
				code: 'import { Button } from "library"; type T = Button.Props;',
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: 'import * as Button from "library"; type T = Button.Props;',
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: 'import Button from "library"; type T = Button.Props;',
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: 'import type { Button } from "library"; type T = Button.Props;',
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: "const err = value;",
				options: [{ replacements: { err: false } }],
			},
			{
				code: "const err = value;",
				options: [{ extendDefaultReplacements: false, replacements: { err: { error: false } } }],
			},
			{
				code: "const value = 1;",
				filename: "<input>",
				options: [{ checkFilenames: true }],
			},
		],
	});

	describe("replacement utilities", () => {
		it("normalizes disabled and malformed replacement overrides", () => {
			expect.assertions(5);

			const options = prepareOptions({
				extendDefaultReplacements: false,
				replacements: {
					err: false,
					fn: "function",
					res: { response: true, result: "yes" },
				},
			});

			expect(getNameReplacements("err", options)).toStrictEqual({ total: 0 });
			expect(getNameReplacements("fn", options)).toStrictEqual({ total: 0 });
			expect(getNameReplacements("res", options)).toStrictEqual({ samples: ["response"], total: 1 });
			expect(isDiscouragedReplacementName("res", options)).toBe(true);
			expect(isDiscouragedReplacementName("missing", options)).toBe(false);
		});

		it("supports shorthand fallbacks, ignored shorthand matches, and property access allow lists", () => {
			expect.assertions(7);

			const options = prepareOptions({
				allowPropertyAccess: ["Txt"],
				ignoreShorthands: ["Btn", "*Props"],
				shorthands: {
					"*Props": "*Properties",
					"/^Txt(.*)$/": "Text$1",
					"/not-a-pattern": "literalPattern",
					Btn: "Button",
				},
			});

			const textReplacement = getShorthandReplacement("TxtLabel", options.shorthandConfiguration);
			const literalReplacement = getShorthandReplacement("/not-a-pattern", options.shorthandConfiguration);
			const propsReplacement = getShorthandReplacement("PanelProps", options.shorthandConfiguration);

			expect(textReplacement?.replaced).toBe("TextLabel");
			assert.ok(textReplacement !== undefined);
			expect(literalReplacement).toBeUndefined();
			expect(propsReplacement?.replaced).toBe("PanelProperties");
			expect(isShorthandIgnored("Btn", options.shorthandConfiguration)).toBe(true);
			expect(isShorthandIgnored("PanelProps", options.shorthandConfiguration)).toBe(true);
			expect(isShorthandIgnored("TxtLabel", options.shorthandConfiguration)).toBe(false);
			expect(isPropertyAccessAllowed("Title", textReplacement, new Set(["Txt"]))).toBe(true);
		});

		it("formats replacement suggestions without omitted counts when all samples are shown", () => {
			expect.assertions(9);

			const options = prepareOptions({
				allowList: { ignored: "yes", kept: true },
				ignore: [123, "test"],
			});
			const overlapOptions = prepareOptions({
				extendDefaultReplacements: false,
				replacements: {
					txt: { textName: true },
				},
			});
			const shorthandOptions = prepareOptions({
				shorthands: {
					"/^([A-Z])([A-Z]+)$/u": "$2$1",
					"/^Btn$/": "$1",
				},
			});

			expect(
				getMessage("res", { samples: ["response", "result"], total: 2 }, "variable").data.replacementsText,
			).toBe("`response`, `result`");
			expect(getMessage("res", { total: 1 }, "variable").data.replacement).toBe("");
			expect(getNameReplacements("ERRValue", options)).toStrictEqual({ total: 0 });
			expect(getShorthandReplacement("", shorthandOptions.shorthandConfiguration)).toBeUndefined();
			expect(getShorthandReplacement("ABC", shorthandOptions.shorthandConfiguration)?.replaced).toBe("BCA");
			expect(getShorthandReplacement("Btn", shorthandOptions.shorthandConfiguration)?.replaced).toBe("");
			expect(getNameReplacements("txtName", overlapOptions)).toStrictEqual({ samples: ["textName"], total: 1 });
			expect(getNameReplacements("kept", options)).toStrictEqual({ total: 0 });
			expect(getNameReplacements("testName", options)).toStrictEqual({ total: 0 });
		});
	});

	tsx.run("prevent-abbreviations JSX", rule, {
		invalid: [
			{
				code: "<Btn />;",
				errors: [
					{
						data: { discouragedName: "Btn", nameTypeText: "variable", replacement: "Button" },
						messageId: "replace",
					},
				],
				options: [{ shorthands: { Btn: "Button" } }],
			},
		],
		valid: [
			{
				code: "<Button />;",
			},
			{
				code: "<btn />;",
				options: [{ shorthands: { Btn: "Button" } }],
			},
		],
	});
});
