import nodePath from "node:path";
import { describe } from "vitest";
import rule from "$oxc-rules/naming/no-spec-file-extension";

import { ts } from "./rule-testers";

const FIXTURES = nodePath.join(import.meta.dirname, "fixtures", "no-spec-file-extension");

describe("no-spec-file-extension", () => {
	ts.run("no-spec-file-extension", rule, {
		invalid: [
			{
				code: "export const x = 1;",
				documentation: { id: "fail", title: "Spec file extension" },
				errors: [{ messageId: "noSpecFileExtension" }],
				filename: "component.spec.ts",
			},
			{
				code: "export const x = 1;",
				errors: [{ messageId: "noSpecFileExtension" }],
				filename: nodePath.join(FIXTURES, "component.spec.tsx"),
			},
			{
				code: "export const x = 1;",
				errors: [{ messageId: "noSpecFileExtension" }],
				filename: nodePath.join(FIXTURES, "Button.spec.ts"),
			},
			{
				code: "export const x = 1;",
				errors: [{ messageId: "noSpecFileExtension" }],
				filename: nodePath.join(FIXTURES, "hooks/useAuth.spec.tsx"),
			},
		],
		valid: [
			{
				code: "export const x = 1;",
				documentation: { id: "pass", title: "Test file extension" },
				filename: "component.test.ts",
			},
			{
				code: "export const x = 1;",
				filename: nodePath.join(FIXTURES, "component.test.tsx"),
			},
			{
				code: "export const x = 1;",
				filename: nodePath.join(FIXTURES, "component.ts"),
			},
			{
				code: "export const x = 1;",
				filename: nodePath.join(FIXTURES, "component.tsx"),
			},
			{
				code: "export const x = 1;",
				filename: nodePath.join(FIXTURES, "utils.js"),
			},
			{
				code: "export const x = 1;",
				filename: nodePath.join(FIXTURES, "utils.jsx"),
			},
			{
				code: "export const x = 1;",
				filename: nodePath.join(FIXTURES, "spec-component.ts"),
			},
			{
				code: "export const x = 1;",
				filename: nodePath.join(FIXTURES, "component.spec-test.ts"),
			},
		],
	});
});
