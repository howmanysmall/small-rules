import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/general/no-runtime-in-type-files";

const TYPE_FILE = "packages/example/src/lib/api-types.ts";
const SOURCE_FILE = "packages/example/src/lib/api.ts";
const RUNTIME_ERROR = [{ messageId: "noRuntimeInTypeFile" }];
const CUSTOM_FILES = [{ files: ["**/*.types.ts"] }];

describe("no-runtime-in-type-files", () => {
	ts.run("no-runtime-in-type-files", rule, {
		invalid: [
			{
				filename: "packages/example/src/lib/api-types.ts",
				code: ['import type { Input } from "./input";', "export const value = 1;"].join("\n"),
				errors: [{ messageId: "noRuntimeInTypeFile" }],
				documentation: { id: "fail", title: "Runtime binding in a type file" },
			},
			{ filename: TYPE_FILE, code: "export function value() { return 1; }", errors: RUNTIME_ERROR },
			{ filename: TYPE_FILE, code: "doThing();", errors: RUNTIME_ERROR },
			{ filename: TYPE_FILE, code: 'import { value } from "./value";', errors: RUNTIME_ERROR },
			{ filename: TYPE_FILE, code: 'import "./value";', errors: RUNTIME_ERROR },
			{ filename: TYPE_FILE, code: 'import Input = require("./input");', errors: RUNTIME_ERROR },
			{ filename: TYPE_FILE, code: 'export { value } from "./value";', errors: RUNTIME_ERROR },
			{ filename: TYPE_FILE, code: "export {};", errors: RUNTIME_ERROR },
			{ filename: TYPE_FILE, code: 'export * from "./value";', errors: RUNTIME_ERROR },
			{ filename: TYPE_FILE, code: "export default 1;", errors: RUNTIME_ERROR },
			{ filename: TYPE_FILE, code: "enum Kind { A }", errors: RUNTIME_ERROR },
			{ filename: TYPE_FILE, code: "namespace Values { export const a = 1; }", errors: RUNTIME_ERROR },
			{ filename: TYPE_FILE, code: "class Value {}", errors: RUNTIME_ERROR },
			{ filename: `/repository/${TYPE_FILE}`, code: "export const value = 1;", errors: RUNTIME_ERROR },
			{
				filename: String.raw`packages\a\src\lib\b-types.ts`,
				code: "export const value = 1;",
				errors: RUNTIME_ERROR,
			},
			{
				filename: "src/api.types.ts",
				code: "export const value = 1;",
				options: CUSTOM_FILES,
				errors: RUNTIME_ERROR,
			},
		],
		valid: [
			{
				filename: "packages/example/src/lib/api-types.ts",
				code: [
					'import type { Input } from "./input";',
					"declare const brand: unique symbol;",
					"export interface Output { readonly value: Input; }",
					"export type Branded = Output & { readonly [brand]: true };",
				].join("\n"),
				documentation: { id: "pass", title: "Declarations that erase" },
			},
			{ filename: TYPE_FILE, code: ";" },
			{ filename: TYPE_FILE, code: 'export type { Input } from "./input";' },
			{ filename: TYPE_FILE, code: 'export type * from "./input";' },
			{ filename: TYPE_FILE, code: 'export { type Input } from "./input";' },
			{ filename: TYPE_FILE, code: 'import { type Input } from "./input";' },
			{ filename: TYPE_FILE, code: 'import type Input = require("./input");' },
			{ filename: TYPE_FILE, code: "export default interface Output { readonly value: string; }" },
			{ filename: TYPE_FILE, code: "export declare function value(): number;" },
			{ filename: TYPE_FILE, code: "declare function value(): number;" },
			{ filename: TYPE_FILE, code: "export function parse(text: string): number;" },
			{ filename: TYPE_FILE, code: "declare enum Kind { A }" },
			{ filename: TYPE_FILE, code: "declare namespace Values { const a: 1; }" },
			{ filename: SOURCE_FILE, code: "export const value = 1;" },
			{ filename: "src/shared/model/api-types.ts", code: "export const value = 1;" },
			{ filename: TYPE_FILE, code: "export const value = 1;", options: CUSTOM_FILES },
		],
	});
});
