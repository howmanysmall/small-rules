import { describe } from "vitest";
import rule from "$oxc-rules/no-ianitor-success-access";

import { ts } from "./rule-testers";

describe("no-ianitor-success-access", () => {
	// @ts-expect-error -- The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ts.run("no-ianitor-success-access", rule, {
		invalid: [
			// Inline .success on Ianitor.keyOf call
			{
				code: `
import { Ianitor } from "@packages/ianitor";
const ids = { a: "a", b: "b" } as const;
const validator = Ianitor.keyOf(ids);
export function isX(value: unknown) {
	return validator(value).success;
}
`,
				errors: [{ messageId: "preferCreateGuard" }],
			},
			// Ianitor.keyOf inline in function body
			{
				code: `
import { Ianitor } from "@packages/ianitor";
const ids = { a: "a", b: "b" } as const;
export function isX(value: unknown) {
	return Ianitor.keyOf(ids)(value).success;
}
`,
				errors: [{ messageId: "preferCreateGuard" }],
			},
			// Any Ianitor method inline .success
			{
				code: `
import { Ianitor } from "@packages/ianitor";
function validate(input: unknown) {
	return Ianitor.string()(input).success;
}
`,
				errors: [{ messageId: "preferCreateGuard" }],
			},
			// Ianitor.strictInterface with .success
			{
				code: `
import { Ianitor } from "@packages/ianitor";
function validate(data: unknown) {
	const schema = { name: Ianitor.string() };
	return Ianitor.strictInterface(schema)(data).success;
}
`,
				errors: [{ messageId: "preferCreateGuard" }],
			},
			// Ianitor.literalList with .success
			{
				code: `
import { Ianitor } from "@packages/ianitor";
const values = ["a", "b"];
function validate(input: unknown) {
	return Ianitor.literalList(values)(input).success;
}
`,
				errors: [{ messageId: "preferCreateGuard" }],
			},
			// Module scope direct .success
			{
				code: `
import { Ianitor } from "@packages/ianitor";
const ids = { a: "a" } as const;
const validator = Ianitor.keyOf(ids);
validator("a").success;
`,
				errors: [{ messageId: "preferCreateGuard" }],
			},
			// Arrow function inline .success
			{
				code: `
import { Ianitor } from "@packages/ianitor";
const ids = { x: "x" } as const;
const check = (value: unknown) => Ianitor.keyOf(ids)(value).success;
`,
				errors: [{ messageId: "preferCreateGuard" }],
			},
			// Destructuring only .success from Ianitor call
			{
				code: `
import { Ianitor } from "@packages/ianitor";
const ids = { a: "a" } as const;
const validator = Ianitor.keyOf(ids);
const { success } = validator("a");
return success;
`,
				errors: [{ messageId: "preferCreateGuard" }],
			},
			// Store result, only access .success (don't return/fwd variable)
			{
				code: `
import { Ianitor } from "@packages/ianitor";
const ids = { a: "a" } as const;
const validator = Ianitor.keyOf(ids);
const result = validator("a");
result.success;
`,
				errors: [{ messageId: "preferCreateGuard" }],
			},
		],
		valid: [
			// Ianitor check stored, no .success access
			`
import { Ianitor } from "@packages/ianitor";
const ids = { a: "a", b: "b" } as const;
const validator = Ianitor.keyOf(ids);
`,
			// Ianitor with type annotation, no .success
			`
import { Ianitor } from "@packages/ianitor";
const isString: Ianitor.Check<string> = Ianitor.string();
`,
			// Non-Ianitor .success
			`
function validate(value: unknown) {
	return SomeApi.call().success;
}
`,
			// Property .success not on call
			`
const obj = { success: true };
console.log(obj.success);
`,
			// Ianitor passed to wrapper (not accessed as .success)
			`
import { Ianitor } from "@packages/ianitor";
function ianitorAssert(check: (v: unknown) => unknown, value: unknown) {}
const ids = { x: "x" } as const;
ianitorAssert(Ianitor.keyOf(ids), "x");
`,
			// Non-Ianitor validator
			`
const validator = SomeLibrary.keyOf(ids);
validator("a").success;
`,
			// Computed ["success"]
			`
import { Ianitor } from "@packages/ianitor";
const ids = { a: "a" } as const;
const validator = Ianitor.keyOf(ids);
validator("a")["success"];
`,
			// Stored result, .success + .error + .value used
			`
import { Ianitor } from "@packages/ianitor";
const ids = { a: "a" } as const;
const validator = Ianitor.keyOf(ids);
const result = validator("a");
if (!result.success) {
	throw new Error(result.error);
}
console.log(result.value);
`,
			// Stored result, .success + .error used
			`
import { Ianitor } from "@packages/ianitor";
const ids = { a: "a" } as const;
const validator = Ianitor.keyOf(ids);
const result = validator("a");
if (!result.success) {
	throw new Error(result.error);
}
`,
			// Destructuring success + error
			`
import { Ianitor } from "@packages/ianitor";
const ids = { a: "a" } as const;
const validator = Ianitor.keyOf(ids);
const { success, error } = validator("a");
if (!success) throw new Error(error);
`,
			// Stored result, .success checked, then variable returned (full result forwarded)
			`
import { Ianitor } from "@packages/ianitor";
const ids = { a: "a" } as const;
function isRgbValue(v: unknown) {
	const validator = Ianitor.keyOf(ids);
	const result = validator(v);
	if (!result.success) return result;
	return result;
}
`,
			// Stored result, .success checked, then variable passed to function
			`
import { Ianitor } from "@packages/ianitor";
const ids = { a: "a" } as const;
function validate(v: unknown) {
	const validator = Ianitor.keyOf(ids);
	const result = validator(v);
	if (!result.success) {
		logError(result);
	}
	return result.value;
}
function logError(r: unknown) { console.log(r); }
`,
		],
	});
});
