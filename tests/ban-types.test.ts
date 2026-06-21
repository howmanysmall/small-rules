import { describe } from "vitest";
import rule from "$oxc-rules/ban-types";

import { ts } from "./rule-testers";

describe("ban-types", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ts.run("ban-types", rule, {
		invalid: [
			{
				code: `
type User = {
		readonly name: string;
		readonly password: string;
};

type HiddenUser = Omit<User, "password">;
`,
				errors: [{ messageId: "bannedTypeWithReplacement" }],
			},
			{
				code: `
type User = {
		readonly name: string;
		readonly password: string;
};

type HiddenUser = Omit<User, "password">;
`,
				errors: [{ messageId: "bannedTypeWithReplacement" }],
				options: [{}],
			},
			{
				code: `
type User = {
		readonly name: string;
};

type FrozenUser = Readonly<User>;
`,
				errors: [{ messageId: "bannedType" }],
				options: [{ bannedTypes: ["Readonly"] }],
			},
			{
				code: `
type User = {
		readonly name: string;
};

type PartialUser = Partial<User>;
`,
				errors: [{ messageId: "bannedTypeWithReplacement" }],
				options: [{ bannedTypes: { Partial: "DeepPartial" } }],
			},
			{
				code: `
type User = {
		readonly name: string;
};

type PartialUser = Utility.Partial<User>;
`,
				errors: [{ messageId: "bannedTypeWithReplacement" }],
				options: [{ bannedTypes: { Partial: "DeepPartial" } }],
			},
			{
				code: `
type User = {
		readonly name: string;
};

type PartialUser = Partial<User>;
`,
				errors: [{ messageId: "bannedType" }],
				options: [{ bannedTypes: { Partial: "" } }],
			},
			{
				code: `
type User = {
		readonly name: string;
};

type FrozenUser = Readonly<User>;
`,
				errors: [{ messageId: "bannedType" }],
				options: [{ bannedTypes: ["readonly"] }],
			},
		],
		valid: [
			{
				code: `
type User = {
		readonly name: string;
};

type ActiveUser = Pick<User, "name">;
`,
			},
			{
				code: `
type User = {
		readonly name: string;
};

type ActiveUser = Pick<User, "name">;
`,
				options: [{ bannedTypes: ["Readonly"] }],
			},
			{
				code: `
type User = {
		readonly name: string;
};

type FrozenUser = Readonly<User>;
`,
				options: [{ bannedTypes: { Partial: "DeepPartial" } }],
			},
			{
				code: `
type User = {
		readonly name: string;
};

type PickedUser = Pick<User, "name">;
`,
				options: [{ bannedTypes: undefined }],
			},
		],
	});
});
