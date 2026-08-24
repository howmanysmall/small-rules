import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-reflect-apply";
import { ts } from "$test/rule-testers";

describe("no-reflect-apply", () => {
	ts.run("no-reflect-apply", rule, {
		invalid: [
			{
				code: "const value = Reflect.apply(operation, owner, args);",
				errors: [{ messageId: "reflectApply" }],
				documentation: { id: "fail", title: "Reflect.apply call" },
			},
			{ code: "Reflect['apply'](operation, owner, args);", errors: [{ messageId: "reflectApply" }] },
		],
		valid: [
			{
				code: "const value = operation.apply(owner, args);",
				documentation: { id: "pass", title: "receiver-aware method call" },
			},
			"const value = operation(owner, args);",
			"const Reflect = { apply() { return 1; } }; Reflect.apply();",
			'import { Reflect } from "./owner"; Reflect.apply();',
			"Reflect[method](operation, owner, args);",
			"Reflect.get(owner, key);",
		],
	});
});
