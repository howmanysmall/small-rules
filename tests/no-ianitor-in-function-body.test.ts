import { describe } from "vitest";
import rule from "$oxc-rules/no-ianitor-in-function-body";

import { ts } from "./rule-testers";

describe("no-ianitor-in-function-body", () => {
	// @ts-expect-error -- shut up
	ts.run("no-ianitor-in-function-body", rule, {
		invalid: [
			// Exact pattern from user's example: Ianitor.keyOf(ids)(value) inside function
			{
				code: `
import { Ianitor } from "@packages/ianitor";

const placementVfxIds = { a: "a", b: "b" } as const;

export function isPlacementVfxId(value: unknown) {
	return Ianitor.keyOf(placementVfxIds)(value).success;
}
`,
				errors: [{ messageId: "hoistIanitorValidator" }],
			},
			// Arrow function body
			{
				code: `
import { Ianitor } from "@packages/ianitor";

const ids = { x: "x" } as const;

const check = (value: unknown) => Ianitor.keyOf(ids)(value).success;
`,
				errors: [{ messageId: "hoistIanitorValidator" }],
			},
			// Nested function
			{
				code: `
import { Ianitor } from "@packages/ianitor";

const ids = { x: "x" } as const;

function outer() {
	function inner() {
		return Ianitor.keyOf(ids)(value).success;
	}
}
`,
				errors: [{ messageId: "hoistIanitorValidator" }],
			},
			// Method expression (e.g., Ianitor.string()())
			{
				code: `
import { Ianitor } from "@packages/ianitor";

function validate(input: unknown) {
	return Ianitor.string()(input).success;
}
`,
				errors: [{ messageId: "hoistIanitorValidator" }],
			},
			// Ianitor.strictInterface inside function
			{
				code: `
import { Ianitor } from "@packages/ianitor";

function validate(data: unknown) {
	const schema = { name: Ianitor.string() };
	return Ianitor.strictInterface(schema)(data).success;
}
`,
				errors: [{ messageId: "hoistIanitorValidator" }],
			},
		],
		valid: [
			// Module-root Ianitor call (hoisted)
			`
import { Ianitor } from "@packages/ianitor";

const placementVfxIds = { a: "a", b: "b" } as const;
const isPlacementVfxIdIanitor = Ianitor.keyOf(placementVfxIds);

export function isPlacementVfxId(value: unknown) {
	return isPlacementVfxIdIanitor(value).success;
}
`,
			// Module-root Ianitor call with type annotation
			`
import { Ianitor } from "@packages/ianitor";

const isString: Ianitor.Check<string> = Ianitor.string();
`,
			// Non-Ianitor member expression inside function
			`
import { Something } from "@packages/something";

function validate(value: unknown) {
	return Something.keyOf(ids)(value).success;
}
`,
			// Ianitor method call without immediate invocation
			`
import { Ianitor } from "@packages/ianitor";

const validator = Ianitor.keyOf(ids);
`,
			// ianitorAssert wrapper (not immediate invocation)
			`
import { Ianitor } from "@packages/ianitor";

function validate(value: unknown) {
	ianitorAssert(Ianitor.keyOf(ids), value);
}
`,
			// Nested call where the inner callee is not an Ianitor member expression
			`
import { Ianitor } from "@packages/ianitor";

function validate(value: unknown) {
	return Ianitor(value)(input).success;
}
`,
		],
	});
});
