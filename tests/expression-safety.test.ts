import { describe, expect, it } from "vitest";
import { isExpressionSideEffectSafe } from "$oxc-utilities/expression-safety";
import { defineRule } from "oxlint-plugin-utilities";

import { createRuleTester } from "./rule-testers";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const testRule = defineRule({
	create(context): Visitor {
		return {
			CallExpression(node): void {
				if (node.callee.type !== "Identifier" || node.callee.name !== "check") return;

				const [argument] = node.arguments;
				if (argument === undefined || argument.type === "SpreadElement") return;

				context.report({
					messageId: isExpressionSideEffectSafe(argument) ? "safe" : "unsafe",
					node: argument,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		messages: {
			safe: "safe",
			unsafe: "unsafe",
		},
		schema: [],
		type: "problem",
	},
});

const tester = createRuleTester({ language: "js", sourceType: "module" });

const templateExpressionCode = `check(\`${String.fromCodePoint(36)}{value}\`);`;

describe("isExpressionSideEffectSafe", () => {
	it("should treat private identifier property keys as safe parser keys", () => {
		expect.assertions(1);

		// Arrange
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Parser types include this object-key union member, but source syntax cannot build it.
		const expression = {
			properties: [
				{
					computed: true,
					key: { name: "value", type: "PrivateIdentifier" },
					kind: "init",
					method: false,
					type: "Property",
					value: { name: "value", type: "Identifier" },
				},
			],
			type: "ObjectExpression",
		} as ESTree.Expression;

		// Act
		const result = isExpressionSideEffectSafe(expression);

		// Assert
		expect(result).toBe(true);
	});

	tester.run("expression-safety", testRule, {
		invalid: [
			{ code: "check(a + b);", errors: [{ messageId: "safe" }] },
			{ code: "check(a && b);", errors: [{ messageId: "safe" }] },
			{ code: "check([, a]);", errors: [{ messageId: "safe" }] },
			{ code: "check({ [key]: value });", errors: [{ messageId: "safe" }] },
			{ code: templateExpressionCode, errors: [{ messageId: "safe" }] },
			{ code: "check((a, b));", errors: [{ messageId: "safe" }] },
			{ code: "check(this);", errors: [{ messageId: "safe" }] },
			{ code: "check(typeof value);", errors: [{ messageId: "safe" }] },
			{ code: "check(obj[prop]);", errors: [{ messageId: "safe" }] },
			{ code: "check(obj?.value);", errors: [{ messageId: "unsafe" }] },
			{ code: "check(call().value);", errors: [{ messageId: "unsafe" }] },
			{
				code: "class Child extends Base { method() { check(super.value); } }",
				errors: [{ messageId: "unsafe" }],
			},
			{ code: "check(delete obj.value);", errors: [{ messageId: "unsafe" }] },
			{ code: "check([a, ...items]);", errors: [{ messageId: "unsafe" }] },
			{ code: "check([call()]);", errors: [{ messageId: "unsafe" }] },
			{ code: "check({ ...extra });", errors: [{ messageId: "unsafe" }] },
			{ code: "check({ method() {} });", errors: [{ messageId: "unsafe" }] },
			{ code: "check({ [call()]: value });", errors: [{ messageId: "unsafe" }] },
			{ code: "check({ value: call() });", errors: [{ messageId: "unsafe" }] },
			{ code: "check((a, call()));", errors: [{ messageId: "unsafe" }] },
			{ code: "check(obj[call()]);", errors: [{ messageId: "unsafe" }] },
			{ code: "check(call());", errors: [{ messageId: "unsafe" }] },
		],
		valid: [],
	});
});
