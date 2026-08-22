import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-chained-type-assertions";

import { ts } from "./rule-testers";

describe("no-chained-type-assertions", () => {
	ts.run("no-chained-type-assertions", rule, {
		invalid: [
			{
				code: "const x = value as string as number;",
				errors: [{ messageId: "chained" }],
				documentation: { id: "fail", title: "chained as assertions" },
			},
			{
				code: "const x = value as string as boolean as number;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = (value as string) as number;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = ((value as string) as number) as boolean;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = <string>value as number;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = <number>(<string>value);",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = value as string as number as boolean;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = value as const as string;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = value as unknown as string;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = value as any as string;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = (value as string as number) as boolean;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = value as string as const;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = <string><number>value;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = <string><number><boolean>value;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = value as unknown as unknown;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = value as unknown as unknown as unknown;",
				errors: [{ messageId: "chained" }],
			},
			{
				code: "const x = value as const as unknown;",
				errors: [{ messageId: "chained" }],
			},
		],
		valid: [
			{
				code: "const x = value as string;",
				documentation: { id: "pass", title: "single as assertion" },
			},
			{
				code: "const x = <string>value;",
			},
			{
				code: "const x = value as const;",
			},
			{
				code: "const x = value as const as const;",
			},
			{
				code: "const x = (value as string);",
			},
			{
				code: "const x = ((value as string));",
			},
			{
				code: "const x = value satisfies string;",
			},
			{
				code: "const x = value;",
			},
			{
				code: "const x = value as Record<string, unknown>;",
			},
		],
	});
});
