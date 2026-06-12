import { describe, expect, it } from "vitest";
import { DEFAULT_STATIC_GLOBAL_FACTORIES, isStaticExpression } from "$oxc-utilities/static-expression-utilities";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

interface StaticExpressionOptions {
	readonly staticGlobalFactories: ReadonlySet<string>;
}

const DEFAULT_OPTIONS: StaticExpressionOptions = {
	staticGlobalFactories: new Set(DEFAULT_STATIC_GLOBAL_FACTORIES),
};

const testRule = defineRule({
	create(context): Visitor {
		return {
			CallExpression(node): void {
				if (node.callee.type !== "Identifier" || node.callee.name !== "check") return;

				const [argument] = node.arguments;
				if (argument === undefined || argument.type === "SpreadElement") return;

				const seen = new Set<ESTree.Node>();
				if (isStaticExpression(context.sourceCode, argument, seen, DEFAULT_OPTIONS)) {
					context.report({ messageId: "static", node: argument });
				} else {
					context.report({ messageId: "dynamic", node: argument });
				}
			},
		} satisfies Visitor;
	},
	meta: {
		messages: {
			dynamic: "dynamic",
			static: "static",
		},
		schema: [],
		type: "problem",
	},
});

const tester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

describe("isStaticExpression checking", () => {
	describe("literals", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check(42);", errors: [{ messageId: "static" }] },
				{ code: "check('hello');", errors: [{ messageId: "static" }] },
				{ code: "check(true);", errors: [{ messageId: "static" }] },
				{ code: "check(null);", errors: [{ messageId: "static" }] },
				{ code: "check(`no interpolation`);", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("imported identifiers", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "import { value } from 'mod'; check(value);", errors: [{ messageId: "static" }] },
				{ code: "import value from 'mod'; check(value);", errors: [{ messageId: "static" }] },
				{ code: "import * as mod from 'mod'; check(mod);", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("module-scope const variables", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "const value = 42; check(value);", errors: [{ messageId: "static" }] },
				{ code: "const value = 'hello'; check(value);", errors: [{ messageId: "static" }] },
				{ code: "const first = 1; const second = first; check(second);", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("global factory identifiers", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check(Color3);", errors: [{ messageId: "static" }] },
				{ code: "check(UDim2);", errors: [{ messageId: "static" }] },
				{ code: "check(TweenInfo);", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("nested static objects", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check({ a: { b: 1 } });", errors: [{ messageId: "static" }] },
				{ code: "check({ x: 1, y: 2, z: 3 });", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("static member expressions", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "const obj = { x: 1 }; check(obj.x);", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("static call expressions", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check(Color3.fromRGB(255, 0, 0));", errors: [{ messageId: "static" }] },
				{ code: "import { fn } from 'mod'; check(fn(1, 2));", errors: [{ messageId: "static" }] },
				{
					code: "const factories = { make: Color3.fromRGB }; check(factories['make'](255, 0, 0));",
					errors: [{ messageId: "static" }],
				},
			],
			valid: [],
		});
	});

	describe("static new expressions", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check(new NumberSequence(0));", errors: [{ messageId: "static" }] },
				{ code: "import { Cls } from 'mod'; check(new Cls(1));", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("unary expressions", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check(!true);", errors: [{ messageId: "static" }] },
				{ code: "check(-1);", errors: [{ messageId: "static" }] },
				{ code: "check(typeof 42);", errors: [{ messageId: "static" }] },
				{ code: "check(void 0);", errors: [{ messageId: "static" }] },
				{ code: "check(~0);", errors: [{ messageId: "static" }] },
				{ code: "check(+1);", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("binary expressions", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check(1 + 2);", errors: [{ messageId: "static" }] },
				{ code: "check(true && false);", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("conditional expressions", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check(true ? 1 : 2);", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("sequence expressions", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check((1, 2, 3));", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("chain expressions", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "const obj = { x: 1 }; check(obj?.x);", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("arrays", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check([1, 2, 3]);", errors: [{ messageId: "static" }] },
				{ code: "check([[1, 2], [3, 4]]);", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});
});

describe("negative cases — dynamic expressions", () => {
	describe("non-module-scope identifiers", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "function run() { const value = 42; check(value); }", errors: [{ messageId: "dynamic" }] },
				{ code: "let value = 42; check(value);", errors: [{ messageId: "dynamic" }] },
				{ code: "var value = 42; check(value);", errors: [{ messageId: "dynamic" }] },
				{ code: "check(unknownGlobal);", errors: [{ messageId: "dynamic" }] },
			],
			valid: [],
		});
	});

	describe("objects with spread elements", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "const obj = { a: 1 }; check({ ...obj });", errors: [{ messageId: "dynamic" }] }],
			valid: [],
		});
	});

	describe("objects with dynamic computed keys", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "function run() { const key = 'a'; check({ [key]: 1 }); }", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("call expressions with non-static arguments", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{
					code: "function run() { const dynamic = 42; check(Color3.fromRGB(dynamic, 0, 0)); }",
					errors: [{ messageId: "dynamic" }],
				},
				{ code: "const args = [1, 2]; check(fn(...args));", errors: [{ messageId: "dynamic" }] },
				{ code: "check((function make() { return 1; })());", errors: [{ messageId: "dynamic" }] },
			],
			valid: [],
		});
	});

	describe("arrow functions and function expressions", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check(() => 42);", errors: [{ messageId: "dynamic" }] },
				{ code: "check(function() { return 42; });", errors: [{ messageId: "dynamic" }] },
			],
			valid: [],
		});
	});

	describe("template literals with expressions", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{
					code: `
const name = 'world';
check(\`hello \${name}\`);
`,
					errors: [{ messageId: "dynamic" }],
				},
			],
			valid: [],
		});
	});

	describe("update expressions", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "let x = 1; check(x++);", errors: [{ messageId: "dynamic" }] }],
			valid: [],
		});
	});
});

describe("circular reference safety (seen set)", () => {
	describe("self-referencing const is not static", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "const a = a; check(a);", errors: [{ messageId: "dynamic" }] }],
			valid: [],
		});
	});
});

describe("logical expressions", () => {
	describe("static logical OR", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check(true || false);", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("static nullish coalescing", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check(null ?? 'default');", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("dynamic logical expression left operand", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "function f() { const x = 1; check(x || false); }", errors: [{ messageId: "dynamic" }] }],
			valid: [],
		});
	});
});

describe("nested module-scope const chains", () => {
	describe("two-level const chain", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{
					code: "const first = { x: 1 }; const second = first; check(second);",
					errors: [{ messageId: "static" }],
				},
			],
			valid: [],
		});
	});

	describe("const referencing a dynamic value is not static", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{
					code: "let mutable = 42; const ref = mutable; check(ref);",
					errors: [{ messageId: "dynamic" }],
				},
			],
			valid: [],
		});
	});

	describe("const referencing a function-scoped variable is not static", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{
					code: "function f() { const inner = 1; const ref = inner; return ref; } check(f());",
					errors: [{ messageId: "dynamic" }],
				},
			],
			valid: [],
		});
	});
});

describe("tS unwrapping expressions", () => {
	const tsTester = new RuleTester({
		languageOptions: { ecmaVersion: 2022, parser, sourceType: "module" },
	});

	describe("as-expression wrapping static value", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tsTester.run("static-expression", testRule, {
			invalid: [{ code: "check(42 as const);", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("nested as-expressions wrapping static value", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tsTester.run("static-expression", testRule, {
			invalid: [{ code: "check((42 as const) as number);", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("satisfies-expression wrapping static value", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tsTester.run("static-expression", testRule, {
			invalid: [
				{
					code: "check({ x: 1 } as const satisfies Record<string, number>);",
					errors: [{ messageId: "static" }],
				},
			],
			valid: [],
		});
	});
});

describe("member expression edge cases", () => {
	describe("computed property with static key", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{
					code: "const obj = { x: 1 }; const key = 'x'; check(obj[key]);",
					errors: [{ messageId: "static" }],
				},
			],
			valid: [],
		});
	});

	describe("deep memberExpression chain", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "const obj = { a: { b: { c: 1 } } }; check(obj.a.b.c);", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});
});

describe("object expression edge cases", () => {
	describe("object with static computed keys", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{
					code: "const key = 'a'; check({ [key]: 1 });",
					errors: [{ messageId: "static" }],
				},
			],
			valid: [],
		});
	});

	describe("object with shorthand properties", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [
				{
					code: "const x = 1; check({ x });",
					errors: [{ messageId: "static" }],
				},
			],
			valid: [],
		});
	});

	describe("object with accessor properties", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check({ get value() { return 1; } });", errors: [{ messageId: "dynamic" }] }],
			valid: [],
		});
	});
});

describe("new expression edge cases", () => {
	describe("new with no arguments", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check(new TweenInfo());", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("new with static member expression callee", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check(new Color3.fromRGB(255, 0, 0));", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});
});

describe("dEFAULT_STATIC_GLOBAL_FACTORIES Array", () => {
	it("contains expected Roblox global factory names", () => {
		expect.assertions(5);

		expect(DEFAULT_STATIC_GLOBAL_FACTORIES).toContain("Color3");
		expect(DEFAULT_STATIC_GLOBAL_FACTORIES).toContain("UDim2");
		expect(DEFAULT_STATIC_GLOBAL_FACTORIES).toContain("TweenInfo");
		expect(DEFAULT_STATIC_GLOBAL_FACTORIES).toContain("Vector3");
		expect(DEFAULT_STATIC_GLOBAL_FACTORIES).toContain("Enum");
	}, 100);
});
