import { join } from "node:path";
import { describe } from "vitest";
import rule from "$oxc-rules/no-spec-file-extension";

import { ts } from "./rule-testers";

const FIXTURES = join(import.meta.dirname, "fixtures", "no-spec-file-extension");

describe("no-spec-file-extension", () => {
	// @ts-expect-error RuleTester types incompatible with runtime rule shape
	ts.run("no-spec-file-extension", rule, {
		invalid: [
			{
				code: "export const x = 1;",
				errors: [{ messageId: "noSpecFileExtension" }],
				filename: join(FIXTURES, "component.spec.ts"),
			},
			{
				code: "export const x = 1;",
				errors: [{ messageId: "noSpecFileExtension" }],
				filename: join(FIXTURES, "component.spec.tsx"),
			},
			{
				code: "export const x = 1;",
				errors: [{ messageId: "noSpecFileExtension" }],
				filename: join(FIXTURES, "Button.spec.ts"),
			},
			{
				code: "export const x = 1;",
				errors: [{ messageId: "noSpecFileExtension" }],
				filename: join(FIXTURES, "hooks/useAuth.spec.tsx"),
			},
		],
		valid: [
			{
				code: "export const x = 1;",
				filename: join(FIXTURES, "component.test.ts"),
			},
			{
				code: "export const x = 1;",
				filename: join(FIXTURES, "component.test.tsx"),
			},
			{
				code: "export const x = 1;",
				filename: join(FIXTURES, "component.ts"),
			},
			{
				code: "export const x = 1;",
				filename: join(FIXTURES, "component.tsx"),
			},
			{
				code: "export const x = 1;",
				filename: join(FIXTURES, "utils.js"),
			},
			{
				code: "export const x = 1;",
				filename: join(FIXTURES, "utils.jsx"),
			},
			{
				code: "export const x = 1;",
				filename: join(FIXTURES, "spec-component.ts"),
			},
			{
				code: "export const x = 1;",
				filename: join(FIXTURES, "component.spec-test.ts"),
			},
		],
	});
});
