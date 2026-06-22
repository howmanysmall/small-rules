import { describe } from "vitest";
import {
	countExpectCalls,
	getTestCallback,
	isExpectAssertionsCall,
	isExpectHasAssertionsCall,
	isTestCaseCall,
} from "$oxc-utilities/jest-utilities";
import { RuleTester } from "eslint";
import { defineRule } from "oxlint-plugin-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

const tester = new RuleTester({
	languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

describe("jest utilities", () => {
	const testCaseMessages = {
		callback: "callback",
		"expect-assertions": "expect-assertions",
		"has-assertions": "has-assertions",
		none: "none",
		"not-test": "not-test",
		test: "test",
	};

	const testCaseRule = defineRule({
		create(context): Visitor {
			return {
				CallExpression(node): void {
					if (isExpectAssertionsCall(node)) {
						context.report({ messageId: "expect-assertions", node });
						return;
					}

					if (isExpectHasAssertionsCall(node)) {
						context.report({ messageId: "has-assertions", node });
						return;
					}

					if (!isTestCaseCall(node)) {
						context.report({ messageId: "not-test", node });
						return;
					}

					context.report({ messageId: getTestCallback(node) === undefined ? "none" : "callback", node });
				},
			} satisfies Visitor;
		},
		meta: { messages: testCaseMessages, schema: [], type: "problem" },
	});

	describe("test case call detection", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("jest-utilities-test-cases", testCaseRule, {
			invalid: [
				{ code: "it('works', () => {});", errors: [{ messageId: "callback" }] },
				{ code: "test.only('works', () => {});", errors: [{ messageId: "callback" }] },
				{ code: "it.skip('works', () => {});", errors: [{ messageId: "callback" }] },
				{
					code: "test.each([[1]])('works', () => {});",
					errors: [{ messageId: "callback" }, { messageId: "not-test" }],
				},
				{
					code: "it()('works', () => {});",
					errors: [{ messageId: "not-test" }, { messageId: "none" }],
				},
				{ code: "it('works');", errors: [{ messageId: "none" }] },
				{ code: "describe('group', () => {});", errors: [{ messageId: "not-test" }] },
				{ code: "expect.assertions(1);", errors: [{ messageId: "expect-assertions" }] },
				{ code: "expect.hasAssertions();", errors: [{ messageId: "has-assertions" }] },
			],
			valid: [],
		});
	});

	const countMessages = {
		callback: "callback",
		deterministic: "deterministic",
		indeterminate: "indeterminate",
		loop: "loop",
	};

	const countRule = defineRule({
		create(context): Visitor {
			return {
				FunctionDeclaration(node): void {
					if (node.body === null) return;

					const count = countExpectCalls(node.body, ["assert"]);
					if (count.hasExpectInLoop) {
						context.report({ messageId: "loop", node });
						return;
					}

					if (count.hasExpectInCallback) {
						context.report({ messageId: "callback", node });
						return;
					}

					if (count.hasIndeterminate) {
						context.report({ messageId: "indeterminate", node });
						return;
					}

					if (count.deterministic > 0) context.report({ messageId: "deterministic", node });
				},
			} satisfies Visitor;
		},
		meta: { messages: countMessages, schema: [], type: "problem" },
	});

	describe("expect call counting", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("jest-utilities-expect-count", countRule, {
			invalid: [
				{
					code: "function run() { expect(value).toBe(true); assert(value); }",
					errors: [{ messageId: "deterministic" }],
				},
				{
					code: "function run() { if (value) expect(value).toBe(true); }",
					errors: [{ messageId: "indeterminate" }],
				},
				{
					code: "function run() { for (const value of values) expect(value).toBe(true); }",
					errors: [{ messageId: "loop" }],
				},
				{
					code: "function run() { values.map((value) => expect(value).toBe(true)); }",
					errors: [{ messageId: "callback" }],
				},
			],
			valid: ["function run() { assert.notAnAssertion(); }"],
		});
	});
});
