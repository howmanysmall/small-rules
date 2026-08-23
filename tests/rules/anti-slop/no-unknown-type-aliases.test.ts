import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-unknown-type-aliases";
import { ts } from "$test/rule-testers";

const unknownAlias = { messageId: "unknownAlias" };

describe("no-unknown-type-aliases", () => {
	ts.run("no-unknown-type-aliases", rule, {
		invalid: [
			{
				code: "type ExternalValue = unknown;",
				errors: [{ messageId: "unknownAlias" }],
				documentation: { id: "fail", title: "renamed unknown alias" },
			},
			{ code: "type Payload = (unknown);", errors: [unknownAlias] },
			{
				code: "type Payload = unknown; export type ExternalPayload = Payload;",
				errors: [unknownAlias, unknownAlias],
			},
			{ code: "type Box<Value> = unknown;", errors: [unknownAlias] },
			{ code: "type UnknownValue = unknown; type Alias = UnknownValue;", errors: [unknownAlias, unknownAlias] },
		],
		valid: [
			{
				code: "type User = { readonly id: string };",
				documentation: { id: "pass", title: "specific type alias" },
			},
			"type Payload = Promise<unknown>;",
			"type Payload<Value> = Value; type ExternalPayload = Payload<unknown>;",
			"type First = Second; type Second = First;",
			"type Alias = string; type UserId = Alias;",
		],
	});
});
