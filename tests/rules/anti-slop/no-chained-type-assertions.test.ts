import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-chained-type-assertions";
import { ts } from "$test/rule-testers";

const chained = { messageId: "chained" };

describe("no-chained-type-assertions", () => {
	ts.run("no-chained-type-assertions", rule, {
		invalid: [
			{
				code: "const x = value as string as number;",
				errors: [{ messageId: "chained" }],
				documentation: { id: "fail", title: "chained as assertions" },
			},
			{ code: "const x = value as string as boolean as number;", errors: [chained] },
			{ code: "const x = (value as string) as number;", errors: [chained] },
			{ code: "const x = ((value as string) as number) as boolean;", errors: [chained] },
			{ code: "const x = <string>value as number;", errors: [chained] },
			{ code: "const x = <number>(<string>value);", errors: [chained] },
			{ code: "const x = <string><number>value;", errors: [chained] },
			{ code: "const x = <string><number><boolean>value;", errors: [chained] },
			{ code: "const x = (value as string as number) as boolean;", errors: [chained] },
			{ code: "const x = value as const as string;", errors: [chained] },
			{ code: "const x = value as string as const;", errors: [chained] },
			{ code: "const x = value as const as unknown;", errors: [chained] },
			{ code: "const x = value as unknown as string;", errors: [chained] },
			{ code: "const x = value as any as string;", errors: [chained] },
			{ code: "const x = value as unknown as unknown;", errors: [chained] },
			{ code: "const x = value as unknown as unknown as unknown;", errors: [chained] },
		],
		valid: [
			{
				code: "const x = value satisfies string;",
				documentation: { id: "pass", title: "satisfies instead of a second assertion" },
			},
			{ code: "const x = value as string;" },
			{ code: "const x = <string>value;" },
			{ code: "const x = value as const;" },
			{ code: "const x = value as const as const;" },
			{ code: "const x = (value as string);" },
			{ code: "const x = ((value as string));" },
			{ code: "const x = value;" },
			{ code: "const x = value satisfies string;" },
			{ code: "const x = value as Record<string, unknown>;" },
		],
	});
});
