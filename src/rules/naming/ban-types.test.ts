import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/naming/ban-types";

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

	ts.run("ban-types heritage clauses", rule, {
		invalid: [
			{
				code: 'interface Base {\n\ta: string;\n\tb: number;\n}\nexport interface Narrow extends Omit<Base, "b"> {}',
				errors: [{ messageId: "bannedTypeWithReplacement" }],
			},
			{
				code: 'interface Base {\n\ta: string;\n\tb: number;\n}\nexport class Impl implements Omit<Base, "b"> {\n\tpublic a = "";\n}',
				errors: [{ messageId: "bannedTypeWithReplacement" }],
			},
			{
				code: 'interface Base {\n\ta: string;\n}\nexport interface Narrow extends Utility.Omit<Base, "a"> {}',
				errors: [{ messageId: "bannedTypeWithReplacement" }],
			},
			{
				code: 'interface Base {\n\ta: string;\n}\nexport class Impl implements Utility.Omit<Base, "a"> {}',
				errors: [{ messageId: "bannedTypeWithReplacement" }],
			},
			{
				code: "export interface Frozen extends Readonly<Base> {}",
				options: [{ bannedTypes: ["Readonly"] }],
				errors: [{ messageId: "bannedType" }],
			},
		],
		valid: [
			'interface Base {\n\ta: string;\n}\nexport interface Narrow extends Pick<Base, "a"> {}',
			'interface Base {\n\ta: string;\n}\nexport class Impl implements Pick<Base, "a"> {}',
			"export class Impl implements this {}",
		],
	});
});
