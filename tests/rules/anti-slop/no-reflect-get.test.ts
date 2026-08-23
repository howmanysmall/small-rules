import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-reflect-get";
import { ts } from "$test/rule-testers";

describe("no-reflect-get", () => {
	ts.run("no-reflect-get", rule, {
		invalid: [
			{
				code: "const value = Reflect.get(owner, key);",
				errors: [{ messageId: "reflectGet" }],
				documentation: { id: "fail", title: "Reflect.get call" },
			},
			{ code: "Reflect['get'](owner, key);", errors: [{ messageId: "reflectGet" }] },
		],
		valid: [
			{
				code: "const value = owner[key];",
				documentation: { id: "pass", title: "typed property access" },
			},
			"const value = owner.property;",
			"const Reflect = { get() { return 1; } }; Reflect.get();",
			'import { Reflect } from "./owner"; Reflect.get();',
			"Reflect[method](owner, key);",
			"Reflect.set(owner, key, value);",
			"apply(owner, key);",
			"class Child extends Parent { read() { super.get(); } }",
		],
	});
});
