import { describe, expect, it } from "vitest";
import {
	DEFAULT_STATIC_GLOBAL_FACTORIES,
	getModuleConstInitializer,
	isExplicitUndefinedExpression,
	isStaticExpression,
} from "$oxc-utilities/static-expression-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import { createRuleTester } from "./rule-testers";

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

const tester = createRuleTester({ language: "js", sourceType: "module" });

const moduleConstInitializerRule = defineRule({
	create(context): Visitor {
		return {
			CallExpression(node): void {
				if (node.callee.type !== "Identifier" || node.callee.name !== "check") return;

				const [argument] = node.arguments;
				if (argument?.type !== "Identifier") return;

				context.report({
					messageId:
						getModuleConstInitializer(context.sourceCode, argument) === undefined ? "missing" : "found",
					node: argument,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		messages: {
			found: "found",
			missing: "missing",
		},
		schema: [],
		type: "problem",
	},
});

const explicitUndefinedRule = defineRule({
	create(context): Visitor {
		return {
			CallExpression(node): void {
				if (node.callee.type !== "Identifier" || node.callee.name !== "check") return;

				const [argument] = node.arguments;
				if (argument === undefined || argument.type === "SpreadElement") return;

				context.report({
					messageId: isExplicitUndefinedExpression(context.sourceCode, argument, new Set())
						? "explicit"
						: "other",
					node: argument,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		messages: {
			explicit: "explicit",
			other: "other",
		},
		schema: [],
		type: "problem",
	},
});

describe("isStaticExpression checking", () => {
	describe("literals", () => {
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
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check({ a: { b: 1 } });", errors: [{ messageId: "static" }] },
				{ code: "check({ x: 1, y: 2, z: 3 });", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("static member expressions", () => {
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "const obj = { x: 1 }; check(obj.x);", errors: [{ messageId: "static" }] },
				{ code: "const obj = { x: 1 }; check(obj['x']);", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("static call expressions", () => {
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
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check(new NumberSequence(0));", errors: [{ messageId: "static" }] },
				{ code: "import { Cls } from 'mod'; check(new Cls(1));", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("unary expressions", () => {
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
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check(1 + 2);", errors: [{ messageId: "static" }] },
				{ code: "check(true && false);", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("conditional expressions", () => {
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check(true ? 1 : 2);", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("sequence expressions", () => {
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check((1, 2, 3));", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("chain expressions", () => {
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check(({ x: 1 })?.x);", errors: [{ messageId: "static" }] },
				{ code: "const obj = { x: 1 }; check(obj?.x);", errors: [{ messageId: "static" }] },
				{
					code: "const factory = { build: () => ({ value: 1 }) }; check(factory?.build()?.value);",
					errors: [{ messageId: "dynamic" }],
				},
			],
			valid: [],
		});
	});

	describe("arrays", () => {
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check([1, 2, 3]);", errors: [{ messageId: "static" }] },
				{ code: "check([[1, 2], [3, 4]]);", errors: [{ messageId: "static" }] },
				{ code: "check([,]);", errors: [{ messageId: "dynamic" }] },
				{ code: "const values = [1]; check([...values]);", errors: [{ messageId: "dynamic" }] },
			],
			valid: [],
		});
	});
});

describe("negative cases — dynamic expressions", () => {
	describe("non-module-scope identifiers", () => {
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
		tester.run("static-expression", testRule, {
			invalid: [{ code: "const obj = { a: 1 }; check({ ...obj });", errors: [{ messageId: "dynamic" }] }],
			valid: [],
		});
	});

	describe("objects with dynamic computed keys", () => {
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "function run() { const key = 'a'; check({ [key]: 1 }); }", errors: [{ messageId: "static" }] },
			],
			valid: [],
		});
	});

	describe("call expressions with non-static arguments", () => {
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
		tester.run("static-expression", testRule, {
			invalid: [
				{ code: "check(() => 42);", errors: [{ messageId: "dynamic" }] },
				{ code: "check(function() { return 42; });", errors: [{ messageId: "dynamic" }] },
				{ code: "check(class Example {});", errors: [{ messageId: "dynamic" }] },
				{ code: "check(import.meta);", errors: [{ messageId: "dynamic" }] },
			],
			valid: [],
		});
	});

	describe("template literals with expressions", () => {
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
		tester.run("static-expression", testRule, {
			invalid: [{ code: "let x = 1; check(x++);", errors: [{ messageId: "dynamic" }] }],
			valid: [],
		});
	});
});

describe("circular reference safety (seen set)", () => {
	describe("self-referencing const is not static", () => {
		tester.run("static-expression", testRule, {
			invalid: [{ code: "const a = a; check(a);", errors: [{ messageId: "dynamic" }] }],
			valid: [],
		});
	});
});

describe("logical expressions", () => {
	describe("static logical OR", () => {
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check(true || false);", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("static nullish coalescing", () => {
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check(null ?? 'default');", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("dynamic logical expression left operand", () => {
		tester.run("static-expression", testRule, {
			invalid: [{ code: "function f() { const x = 1; check(x || false); }", errors: [{ messageId: "dynamic" }] }],
			valid: [],
		});
	});
});

describe("nested module-scope const chains", () => {
	describe("two-level const chain", () => {
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
	const tsTester = createRuleTester({ language: "ts", sourceType: "module" });

	describe("as-expression wrapping static value", () => {
		tsTester.run("static-expression", testRule, {
			invalid: [{ code: "check(42 as const);", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("nested as-expressions wrapping static value", () => {
		tsTester.run("static-expression", testRule, {
			invalid: [{ code: "check((42 as const) as number);", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("satisfies-expression wrapping static value", () => {
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

describe("getModuleConstInitializer utility", () => {
	tester.run("module-const-initializer", moduleConstInitializerRule, {
		invalid: [
			{ code: "const value = 42; check(value);", errors: [{ messageId: "found" }] },
			{ code: "let value = 42; check(value);", errors: [{ messageId: "missing" }] },
			{ code: "const value = undefined; check(value);", errors: [{ messageId: "found" }] },
			{ code: "function run(value) { check(value); }", errors: [{ messageId: "missing" }] },
		],
		valid: [],
	});
});

describe("isExplicitUndefinedExpression utility", () => {
	tester.run("explicit-undefined", explicitUndefinedRule, {
		invalid: [
			{ code: "check(undefined);", errors: [{ messageId: "explicit" }] },
			{ code: "check(void 0);", errors: [{ messageId: "explicit" }] },
			{ code: "const value = undefined; check(value);", errors: [{ messageId: "explicit" }] },
			{ code: "const value = void 0; check(value);", errors: [{ messageId: "explicit" }] },
			{ code: "check(unknownGlobal);", errors: [{ messageId: "other" }] },
			{ code: "const value = value; check(value);", errors: [{ messageId: "other" }] },
			{ code: "let value; check(value);", errors: [{ messageId: "other" }] },
			{ code: "const value = 1; check(value);", errors: [{ messageId: "other" }] },
		],
		valid: [],
	});
});

describe("member expression edge cases", () => {
	describe("computed property with static key", () => {
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
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check({ get value() { return 1; } });", errors: [{ messageId: "dynamic" }] }],
			valid: [],
		});
	});
});

describe("new expression edge cases", () => {
	describe("new with no arguments", () => {
		tester.run("static-expression", testRule, {
			invalid: [{ code: "check(new TweenInfo());", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("new with static member expression callee", () => {
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
