import { describe } from "vitest";

import rule from "$oxc-rules/naming/ban-types";

import { ts } from "./rule-testers";

describe("ban-types", () => {
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
				documentation: { id: "fail", title: "Disallowed Omit utility type" },
			},
			{
				code: `
type User = {
		readonly name: string;
		readonly password: string;
};

type HiddenUser = Omit<User, "password">;
`,
				options: [{}],
				errors: [{ messageId: "bannedTypeWithReplacement" }],
			},
			{
				code: `
type User = {
		readonly name: string;
};

type FrozenUser = Readonly<User>;
`,
				options: [{ bannedTypes: ["Readonly"] }],
				errors: [{ messageId: "bannedType" }],
			},
			{
				code: `
type User = {
		readonly name: string;
};

type PartialUser = Partial<User>;
`,
				options: [{ bannedTypes: { Partial: "DeepPartial" } }],
				errors: [{ messageId: "bannedTypeWithReplacement" }],
			},
			{
				code: `
type User = {
		readonly name: string;
};

type PartialUser = Utility.Partial<User>;
`,
				options: [{ bannedTypes: { Partial: "DeepPartial" } }],
				errors: [{ messageId: "bannedTypeWithReplacement" }],
			},
			{
				code: `
type User = {
		readonly name: string;
};

type PartialUser = Partial<User>;
`,
				options: [{ bannedTypes: { Partial: "" } }],
				errors: [{ messageId: "bannedType" }],
			},
			{
				code: `
type User = {
		readonly name: string;
};

type FrozenUser = Readonly<User>;
`,
				options: [{ bannedTypes: ["readonly"] }],
				errors: [{ messageId: "bannedType" }],
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
				documentation: { id: "pass", title: "Allowed Pick utility type" },
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
				options: [{}],
			},
		],
	});
});
