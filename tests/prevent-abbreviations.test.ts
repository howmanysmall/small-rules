import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";

import rule from "$oxc-rules/naming/prevent-abbreviations";
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

const MANY_REPLACEMENTS = Object.fromEntries(
	Array.from({ length: 104 }, (_, index) => [`replacement${index.toString().padStart(3, "0")}`, true]),
);

describe("prevent-abbreviations", () => {
	ts.run("prevent-abbreviations", rule, {
		invalid: [
			// Variable declaration with abbreviation (const)
			{
				code: "const err = new Error();",
				output: "const error = new Error();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				documentation: { id: "fail", title: "Abbreviated variable names" },
			},
			// Default shorthand replacement takes priority
			{
				code: "let args = [1, 2, 3];",
				output: "let parameters = [1, 2, 3];",
				errors: [
					{
						data: { discouragedName: "args", nameTypeText: "variable", replacement: "parameters" },
						messageId: "replace",
					},
				],
			},
			{
				code: "const plr = getPlayer();",
				output: "const player = getPlayer();",
				errors: [{ messageId: "replace" }],
			},
			{
				code: "const plr = Players.LocalPlayer;",
				output: "const localPlayer = Players.LocalPlayer;",
				errors: [
					{
						data: { discouragedName: "plr", nameTypeText: "variable", replacement: "localPlayer" },
						messageId: "replace",
					},
				],
			},
			{
				code: "const dt = 0.016;",
				output: "const deltaTime = 0.016;",
				errors: [
					{
						data: { discouragedName: "dt", nameTypeText: "variable", replacement: "deltaTime" },
						messageId: "replace",
					},
				],
			},
			{
				code: "const char = getCharacter();",
				output: "const character = getCharacter();",
				errors: [{ messageId: "replace" }],
			},
			// Variable declaration with abbreviation (var)
			{
				code: "var dist = 10;",
				output: "var distance = 10;",
				errors: [
					{
						data: { discouragedName: "dist", nameTypeText: "variable", replacement: "distance" },
						messageId: "replace",
					},
				],
			},
			// Function parameter with abbreviation
			{
				code: "function foo(err) { return err; }",
				output: "function foo(error) { return error; }",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: "function foo(err = fallback) { return err; }",
				output: "function foo(error = fallback) { return error; }",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: "function foo(plr) { return plr; }",
				output: "function foo(player) { return player; }",
				errors: [{ messageId: "replace" }],
			},
			{
				code: "const { plr } = obj;",
				output: "const { plr: player } = obj;",
				errors: [{ messageId: "replace" }],
			},
			// Property name with abbreviation (when checkProperties: true)
			{
				code: "const obj = { err: 'value' };",
				output: "const obj = { error: 'value' };",
				options: [{ checkProperties: true }],
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
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
				options: [{ replacements: { res: { resource: true, response: true, result: true } } }],
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
			},
			{
				code: "const abbr = value;",
				options: [{ replacements: { abbr: MANY_REPLACEMENTS } }],
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
			},
			{
				code: "const Res = value;",
				options: [{ replacements: { res: { resource: true, response: true, result: true } } }],
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
			},
			// Custom replacements
			{
				code: "const custom = 'test';",
				output: "const customReplacement = 'test';",
				options: [{ replacements: { custom: { customReplacement: true } } }],
				errors: [
					{
						data: { discouragedName: "custom", nameTypeText: "variable", replacement: "customReplacement" },
						messageId: "replace",
					},
				],
			},
			// Custom shorthand replacement
			{
				code: "const result = obj.fr;",
				options: [{ checkShorthandProperties: true, shorthands: { fr: "fullResult" } }],
				errors: [
					{
						data: { discouragedName: "fr", nameTypeText: "property", replacement: "fullResult" },
						messageId: "replace",
					},
				],
			},
			{
				code: "getThing().fr;",
				options: [{ checkShorthandProperties: true, shorthands: { fr: "fullResult" } }],
				errors: [
					{
						data: { discouragedName: "fr", nameTypeText: "property", replacement: "fullResult" },
						messageId: "replace",
					},
				],
			},
			{
				code: "interface UnitBoxBadgeInfoProps {}",
				output: "interface UnitBoxBadgeInfoProperties {}",
				options: [{ shorthands: { Props: "Properties" } }],
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
			},
			{
				code: "const myBtnClick = () => {};",
				output: "const myButtonClick = () => {};",
				options: [{ shorthands: { "*Btn*": "*Button*" } }],
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
			},
			{
				code: "const GEM_PANEL_FRAME_PROPS = {};",
				output: "const GEM_PANEL_FRAME_PROPERTIES = {};",
				options: [{ shorthands: { "*PROPS": "*PROPERTIES" } }],
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
			},
			{
				code: "const TEXT_LABEL_TXT_GRAD_N_PROPS_2 = {};",
				output: "const TEXT_LABEL_TXT_GRAD_N_PROPERTIES_2 = {};",
				options: [{ shorthands: { "*PROPS": "*PROPERTIES" } }],
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
			},
			{
				code: "const strName = '';",
				output: "const stringName = '';",
				options: [{ shorthands: { "/^str(.*)$/": "string$1" } }],
				errors: [
					{
						data: { discouragedName: "strName", nameTypeText: "variable", replacement: "stringName" },
						messageId: "replace",
					},
				],
			},
			{
				code: "const first = 1; const second = 2;",
				output: "const value = 1; const value_ = 2;",
				options: [
					{
						replacements: {
							first: { value: true },
							second: { value: true },
						},
					},
				],
				errors: [{ messageId: "replace" }, { messageId: "replace" }],
			},
			{
				code: "const target = 1; const source = 2;",
				output: "const destination = 1; const source = 2;",
				options: [
					{
						extendDefaultReplacements: false,
						replacements: {
							source: { target: true },
							target: { destination: true },
						},
					},
				],
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
			},
			{
				code: "let param;",
				options: [{ replacements: { param: { arguments: true } } }],
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
			},
			{
				code: "const handler = (param) => param;",
				options: [{ replacements: { param: { arguments: true } } }],
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
			},
			{
				code: "const { err = fallback } = payload;",
				output: "const { err: error = fallback } = payload;",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			// CamelCase word splitting
			{
				code: "const myErr = new Error();",
				output: "const myError = new Error();",
				errors: [
					{
						data: { discouragedName: "myErr", nameTypeText: "variable", replacement: "myError" },
						messageId: "replace",
					},
				],
			},
			{
				filename: "src/err.ts",
				code: "const value = 1;",
				options: [{ checkFilenames: true }],
				errors: [
					{
						data: { discouragedName: "err.ts", nameTypeText: "filename", replacement: "error.ts" },
						messageId: "replace",
					},
				],
			},
			{
				code: 'import err from "./module";',
				output: 'import error from "./module";',
				options: [{ checkDefaultAndNamespaceImports: true }],
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: 'import * as args from "./module";',
				output: 'import * as parameters from "./module";',
				options: [{ checkDefaultAndNamespaceImports: "internal" }],
				errors: [
					{
						data: { discouragedName: "args", nameTypeText: "variable", replacement: "parameters" },
						messageId: "replace",
					},
				],
			},
			{
				code: 'import { err } from "./module";',
				output: 'import { err as error } from "./module";',
				options: [{ checkShorthandImports: true }],
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: "const err = 1; export { err };",
				output: "const error = 1; export { error as err };",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
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
				options: [{ replacements: { err: { error: true } } }],
				errors: [
					{
						data: { discouragedName: "Err", nameTypeText: "variable", replacement: "Error_" },
						messageId: "replace",
					},
				],
			},
			{
				code: "export type Err = string;",
				options: [{ replacements: { err: { error: true } } }],
				errors: [
					{
						data: { discouragedName: "Err", nameTypeText: "variable", replacement: "Error_" },
						messageId: "replace",
					},
				],
			},
			{
				code: "interface Shape { err: string }",
				options: [{ checkProperties: true }],
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: "class Shape { err = 1 }",
				options: [{ checkProperties: true }],
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: "const payload = { err: 1 };",
				options: [{ checkProperties: true }],
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: "const err = value;",
				options: [{ replacements: { err: { "bad-name": true } } }],
				errors: [
					{
						messageId: "suggestion",
					},
				],
			},
			{
				code: 'import { default as err } from "./module";',
				output: 'import { default as error } from "./module";',
				options: [{ checkDefaultAndNamespaceImports: true }],
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: 'const err = require("./module");',
				output: 'const error = require("./module");',
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: "target.err = 1;",
				options: [{ checkProperties: true }],
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				filename: "src/err",
				code: "const value = 1;",
				options: [{ checkFilenames: true }],
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "filename", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: "class Shape { err() {} }",
				options: [{ checkProperties: true }],
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: "const { err: value } = payload;",
				options: [{ checkProperties: true }],
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: 'import { useRender } from "./use-render"; useRender({ props: value });',
				options: [{ checkProperties: true }],
				errors: [{ messageId: "replace" }],
			},
			{
				code: 'import { useRender } from "$components/use-render"; useRender({ props: value });',
				options: [{ checkProperties: true }],
				errors: [{ messageId: "replace" }],
			},
			{
				code: "function useRender(options) { return options; } useRender({ props: value });",
				options: [{ checkProperties: true }],
				errors: [{ messageId: "replace" }],
			},
			{
				code: 'import { useRender } from "@base-ui/react/use-render"; useRender({ configuration: { props: value } });',
				options: [{ checkProperties: true }],
				errors: [{ messageId: "replace" }],
			},
			{
				code: 'import { useRender } from "@base-ui/react/use-render"; const options = { props: value }; useRender(options);',
				options: [{ checkProperties: true }],
				errors: [{ messageId: "replace" }],
			},
			{
				code: "({ props: value })();",
				options: [{ checkProperties: true }],
				errors: [{ messageId: "replace" }],
			},
			{
				code: 'import * as BaseUi from "@base-ui/react"; BaseUi.useRender({ props: value });',
				options: [{ checkProperties: true }],
				errors: [{ messageId: "replace" }],
			},
			{
				code: 'import type { RenderConfiguration } from "./render"; const options: RenderConfiguration = { props: value };',
				options: [{ checkProperties: true }],
				errors: [{ messageId: "replace" }],
			},
			{
				code: "type RenderOptions = { value: unknown }; const options: RenderOptions = { props: value };",
				options: [{ checkProperties: true }],
				errors: [{ messageId: "replace" }],
			},
			{
				code: "const options: { value: unknown } = { props: value };",
				options: [{ checkProperties: true }],
				errors: [{ messageId: "replace" }],
			},
			{
				code: 'const options: import("./render").RenderConfiguration = { props: value };',
				options: [{ checkProperties: true }],
				errors: [{ messageId: "replace" }],
			},
			// Three-level TSQualifiedName chain without import — still flagged
			{
				code: "namespace N { export namespace Root { export type Props = unknown; } } type T = N.Root.Props;",
				options: [{ checkVariables: false, shorthands: { "*Props": "*Properties", "*Root": "*Base" } }],
				errors: [{ messageId: "replace" }, { messageId: "replace" }],
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
				options: [{ ignore: ["^test"] }],
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
				documentation: { id: "pass", title: "Expanded variable names" },
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
				filename: "src/value.ts",
				code: "const value = 1;",
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
			// Three-level TSQualifiedName chain with import — should not flag
			{
				code: 'import * as MenuPrimitive from "library"; type T = MenuPrimitive.Root.Props;',
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: 'import * as MenuPrimitive from "library"; type T = MenuPrimitive.Root.Props;',
				options: [{ shorthands: { "*Root": "*Base" } }],
			},
			// Three-level MemberExpression chain with import — should not flag
			{
				code: 'import * as MenuPrimitive from "library"; const result = MenuPrimitive.Root.Props;',
				options: [{ checkShorthandProperties: true, shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: 'import * as MenuPrimitive from "library"; const result = MenuPrimitive.Root.Props;',
				options: [{ checkShorthandProperties: true, shorthands: { "*Root": "*Base" } }],
			},
			{
				code: 'import { useRender } from "@base-ui/react/use-render"; useRender({ props: value });',
				options: [{ checkProperties: true }],
			},
			{
				code: 'import { useRender as render } from "@base-ui/react/use-render"; render({ props: value });',
				options: [{ shorthands: { props: "properties" } }],
			},
			{
				code: 'import configure from "library"; configure({ args: value });',
				options: [{ checkProperties: true }],
			},
			{
				code: 'import type { RenderProps } from "@base-ui/react"; const options: RenderProps = { props: value };',
				options: [{ checkProperties: true }],
			},
			{
				code: 'import type * as BaseUi from "@base-ui/react"; const options: BaseUi.RenderProps = { props: value };',
				options: [{ checkProperties: true }],
			},
			{
				code: 'const options: import("@base-ui/react").RenderProps = { props: value };',
				options: [{ checkProperties: true }],
			},
			{
				code: 'import type { RenderProps } from "@base-ui/react"; const options = { props: value } satisfies RenderProps;',
				options: [{ checkProperties: true }],
			},
			{
				code: 'import type { RenderProps } from "@base-ui/react"; const options = { props: value } as RenderProps;',
				options: [{ checkProperties: true }],
			},
			{
				code: 'import type { RenderProps } from "@base-ui/react"; const options = <RenderProps>{ props: value };',
				options: [{ checkProperties: true }],
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
				filename: "<input>",
				code: "const value = 1;",
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
			expect.assertions(9);

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
			expect(getShorthandReplacement("Btn2", options.shorthandConfiguration)?.replaced).toBe("Button2");
			expect(isShorthandIgnored("Btn", options.shorthandConfiguration)).toBe(true);
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

		it("normalizes ignore patterns with RegExp instances", () => {
			expect.assertions(4);

			const options = prepareOptions({
				ignore: [/^test/u, "regexString"],
			});

			// RegExp instances pass through directly; strings get converted
			for (const pattern of options.ignore) {
				expect(pattern instanceof RegExp).toBe(true);
			}
		});

		it("reuses normalized configuration while isolating per-run lookup caches", () => {
			expect.assertions(9);

			const configuration = {
				ignoreShorthands: ["Props"],
				replacements: { res: { response: true, result: true } },
				shorthands: { Props: "Properties" },
			};
			const firstOptions = prepareOptions(configuration);
			const secondOptions = prepareOptions(configuration);
			const firstShorthand = getShorthandReplacement("PanelProps", firstOptions.shorthandConfiguration);
			const firstNameReplacements = getNameReplacements("res", firstOptions);

			expect(firstOptions).not.toBe(secondOptions);
			expect(firstOptions.allowList).toBe(secondOptions.allowList);
			expect(firstOptions.allowPropertyAccess).toBe(secondOptions.allowPropertyAccess);
			expect(firstOptions.ignore).toBe(secondOptions.ignore);
			expect(firstOptions.replacements).toBe(secondOptions.replacements);
			expect(firstOptions.shorthandConfiguration.exactMatchers).toBe(
				secondOptions.shorthandConfiguration.exactMatchers,
			);
			expect(getShorthandReplacement("PanelProps", firstOptions.shorthandConfiguration)).toBe(firstShorthand);
			expect(getNameReplacements("res", firstOptions)).toBe(firstNameReplacements);
			expect(getNameReplacements("res", secondOptions)).not.toBe(firstNameReplacements);
		});
	});

	tsx.run("prevent-abbreviations JSX", rule, {
		invalid: [
			{
				code: "<Btn />;",
				options: [{ shorthands: { Btn: "Button" } }],
				errors: [
					{
						data: { discouragedName: "Btn", nameTypeText: "variable", replacement: "Button" },
						messageId: "replace",
					},
				],
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
