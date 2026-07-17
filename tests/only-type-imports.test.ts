import { describe } from "vitest";
import rule from "$oxc-rules/only-type-imports";

import { ts } from "./rule-testers";

describe("only-type-imports", () => {
	ts.run("only-type-imports", rule, {
		invalid: [
			{
				code: 'import { Foo } from "./bar";',
				documentation: { id: "fail", title: "Value import needs type keyword" },
				errors: [{ messageId: "onlyTypeImports" }],
			},
			{
				code: 'import Foo from "./bar";',
				errors: [{ messageId: "onlyTypeImports" }],
			},
			{
				code: 'import { Foo, Bar } from "./bar";',
				errors: [{ messageId: "onlyTypeImports" }],
			},
			{
				code: 'import * as Foo from "./bar";',
				errors: [{ messageId: "onlyTypeImports" }],
			},
			{
				code: 'import "./polyfill";',
				errors: [{ messageId: "onlyTypeImports" }],
			},
		],
		valid: [
			{
				code: 'import type { Foo } from "./bar";',
				documentation: { id: "pass", title: "Type-only import declaration" },
			},
			'import type Foo from "./bar";',
			'import type { Foo, Bar } from "./bar";',
			'import type * as Foo from "./bar";',
		],
	});
});
