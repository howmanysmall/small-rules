import { describe, expect, it } from "vitest";
import { fc } from "@fast-check/vitest";
import { defineRule } from "oxlint-plugin-utilities";

import {
	DEFAULT_STATIC_GLOBAL_FACTORIES,
	getModuleConstInitializer,
	isExplicitUndefinedExpression,
	isStaticExpression,
} from "$oxc-utilities/static-expression-utilities";
import { PROPERTY_RUNS } from "$test/property-runs";
import { createRuleExecutor } from "$test/rule-harness/execute";
import { createRuleTester } from "$test/rule-testers";

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
				// Catches a constant used twice being taken for a self-reference.
				// Shrunk from the classification property.
				{ code: "const first = 1; check(first ? first : '');", errors: [{ messageId: "static" }] },
				{
					code: "const first = 1; const second = first + first; check([second, second]);",
					errors: [{ messageId: "static" }],
				},
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
				// Catches a function-local key being treated as static, which let
				// rules hoist the object out of the scope that defines the key.
				{
					code: "function run() { const key = 'a'; check({ [key]: 1 }); }",
					errors: [{ messageId: "dynamic" }],
				},
				{ code: "check(({ value: 1 })[unknownGlobal]);", errors: [{ messageId: "dynamic" }] },
				{
					code: "function run(key) { const table = { a: 1 }; check(table[key]); }",
					errors: [{ messageId: "dynamic" }],
				},
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

// Every program declares these bindings, so generated leaves can refer to
// module constants, an import, mutable module state, and a function local.
const PRELUDE = [
	'import { imported } from "mod";',
	"const first = 1;",
	'const second = "second";',
	"let mutable = 2;",
	"let counter = 0;",
	"function run() {",
	"const localValue = 3;",
].join("\n");

const HOLE = "__dynamic__";

const staticLeafArbitrary = fc.oneof(
	fc.nat().map(String),
	fc.string().map((text) => JSON.stringify(text)),
	fc.stringMatching(/^[a-z ]*$/u).map((text) => `\`${text}\``),
	fc.constantFrom("true", "false", "null", "first", "second", "imported", "Color3", "UDim2"),
);

const staticBinaryOperatorArbitrary = fc.constantFrom(
	"+",
	"-",
	"*",
	"/",
	"%",
	"**",
	"===",
	"!==",
	"<",
	">=",
	"&&",
	"||",
	"??",
	"&",
	"|",
	"<<",
);

const staticUnaryOperatorArbitrary = fc.constantFrom("!", "+", "-", "~", "typeof ", "void ");

type StaticArbitraries = Record<"composite" | "expression", string>;

const staticArbitraries = fc.letrec<StaticArbitraries>((tie) => ({
	composite: fc.oneof(
		fc
			.tuple(staticUnaryOperatorArbitrary, tie("expression"))
			.map(([operator, argument]) => `(${operator}(${argument}))`),
		fc
			.tuple(tie("expression"), staticBinaryOperatorArbitrary, tie("expression"))
			.map(([left, operator, right]) => `(${left} ${operator} ${right})`),
		fc.tuple(tie("expression"), tie("expression"), tie("expression")).map(([test, consequent, alternate]) => {
			return `(${test} ? ${consequent} : ${alternate})`;
		}),
		fc.tuple(tie("expression"), tie("expression")).map(([head, tail]) => `(${head}, ${tail})`),
		fc.array(tie("expression"), { size: "xsmall" }).map((elements) => `[${elements.join(", ")}]`),
		tie("expression").map((value) => `({ value: ${value} }).value`),
		tie("expression").map((value) => `({ value: ${value} })["value"]`),
		fc.tuple(tie("expression"), tie("expression")).map(([red, green]) => `Color3.fromRGB(${red}, ${green}, 0)`),
		fc.tuple(tie("expression"), tie("expression")).map(([scale, offset]) => `new UDim(${scale}, ${offset})`),
		tie("expression").map((argument) => `imported(${argument})`),
	),
	expression: fc.oneof({ depthSize: "small", withCrossShrink: true }, staticLeafArbitrary, tie("composite")),
}));

const staticExpressionArbitrary = staticArbitraries.expression;

type DynamicContextArbitraries = Record<"context" | "wrapped", string>;

// Static trees with exactly one `HOLE` leaf, in any operand position.
const dynamicContextArbitraries = fc.letrec<DynamicContextArbitraries>((tie) => ({
	context: fc.oneof({ depthSize: "small", withCrossShrink: true }, fc.constant(HOLE), tie("wrapped")),
	wrapped: fc.oneof(
		fc.tuple(staticUnaryOperatorArbitrary, tie("context")).map(([operator, inner]) => `(${operator}(${inner}))`),
		fc
			.tuple(tie("context"), staticBinaryOperatorArbitrary, staticExpressionArbitrary)
			.map(([left, operator, right]) => `(${left} ${operator} ${right})`),
		fc
			.tuple(staticExpressionArbitrary, staticBinaryOperatorArbitrary, tie("context"))
			.map(([left, operator, right]) => `(${left} ${operator} ${right})`),
		fc
			.tuple(tie("context"), staticExpressionArbitrary, staticExpressionArbitrary, fc.nat({ max: 2 }))
			.map(([inner, other, another, position]) => {
				const operands = [other, another];
				operands.splice(position, 0, inner);
				return `(${operands[0]} ? ${operands[1]} : ${operands[2]})`;
			}),
		fc.tuple(staticExpressionArbitrary, tie("context")).map(([head, inner]) => `(${head}, ${inner})`),
		fc
			.tuple(fc.array(staticExpressionArbitrary, { size: "xsmall" }), tie("context"))
			.map(([elements, inner]) => `[${[...elements, inner].join(", ")}]`),
		tie("context").map((inner) => `({ value: ${inner} }).value`),
		tie("context").map((inner) => `({ value: 1 })[${inner}]`),
		tie("context").map((inner) => `({ [${inner}]: 1 })`),
		tie("context").map((inner) => `Color3.fromRGB(${inner}, 0, 0)`),
		tie("context").map((inner) => `new UDim(0, ${inner})`),
	),
}));

const dynamicContextArbitrary = dynamicContextArbitraries.context;

const dynamicLeafArbitrary = fc.constantFrom(
	"counter++",
	"mutable",
	"localValue",
	"unknownGlobal",
	"(() => 1)",
	toInterpolatingTemplate("first"),
	"(delete ({ value: 1 }).value)",
);

describe("isStaticExpression properties", () => {
	const classify = createRuleExecutor("static-expression", testRule);

	it("should classify any tree of literals, module constants, and factory calls as static", () => {
		// Catches a static expression being rejected because it is nested,
		// combined, or reuses a module constant.
		expect.hasAssertions();

		const report = fc.defaultReportMessage(
			fc.check(
				fc.property(staticExpressionArbitrary, (expression) => {
					// Act
					const messageIds = classifyCheckedExpression(classify, expression);

					// Assert
					expect(messageIds).toStrictEqual(["static"]);
				}),
				{ numRuns: PROPERTY_RUNS },
			),
		);

		// Assert
		expect(report).toBeUndefined();
	});

	it("should classify a static tree as dynamic once any leaf is dynamic", () => {
		// Catches one dynamic operand being overlooked inside an otherwise
		// static expression, which would let rules hoist or inline it.
		expect.hasAssertions();

		const report = fc.defaultReportMessage(
			fc.check(
				fc.property(dynamicContextArbitrary, dynamicLeafArbitrary, (context, leaf) => {
					// Act
					const messageIds = classifyCheckedExpression(
						classify,
						context.replace(HOLE, () => leaf),
					);

					// Assert
					expect(messageIds).toStrictEqual(["dynamic"]);
				}),
				{ numRuns: PROPERTY_RUNS },
			),
		);

		// Assert
		expect(report).toBeUndefined();
	});
});

// Helpers

function classifyCheckedExpression(
	classify: ReturnType<typeof createRuleExecutor>,
	expression: string,
): ReadonlyArray<string | undefined> {
	const code = `${PRELUDE}\ncheck(${expression});\n}`;
	const { diagnostics } = classify({
		code,
		filename: "case.js",
		kind: "valid",
		language: "js",
		options: [],
		settings: {},
		sourceType: "module",
	});
	return diagnostics.map(({ messageId }) => messageId);
}

function toInterpolatingTemplate(name: string): string {
	return `\`\${${name}}\``;
}
