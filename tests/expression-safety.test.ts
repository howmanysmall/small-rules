import { describe } from "vitest";
import { isExpressionSideEffectSafe } from "$oxc-utilities/expression-safety";
import { RuleTester } from "eslint";
import { defineRule } from "oxlint-plugin-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

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

const tester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

const templateExpressionCode = `check(\`${String.fromCodePoint(36)}{value}\`);`;

describe("isExpressionSideEffectSafe", () => {
	// @ts-expect-error -- RuleTester.run() type mismatch
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
			{ code: "check(obj[call()]);", errors: [{ messageId: "unsafe" }] },
			{ code: "check(call());", errors: [{ messageId: "unsafe" }] },
		],
		valid: [],
	});
});
