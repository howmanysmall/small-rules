import { describe } from "vitest";
import rule from "$oxc-rules/prefer-expect-assertions";

import { ts } from "./rule-testers";

describe("prefer-expect-assertions", () => {
	ts.run("prefer-expect-assertions", rule, {
		invalid: [
			{
				code: "test('works', () => { expect.assertions(1); expect(value).toBe(1); expect(other).toBe(2); });",
				errors: [{ messageId: "wrongAssertionCount" }],
			},
			{
				code: "test('works', () => { expect.assertions(3); expect(value).toBe(1); expect(other).toBe(2); });",
				errors: [{ messageId: "wrongAssertionCount" }],
			},
			{
				code: "test('works', () => { expect(value).toBe(1); expect(other).toBe(2); });",
				errors: [
					{
						messageId: "haveExpectAssertions",
						suggestions: [
							{
								desc: "Add `expect.assertions(2)`",
								output: "test('works', () => { expect.assertions(2);\nexpect(value).toBe(1); expect(other).toBe(2); });",
							},
						],
					},
				],
			},
			{
				code: "test('works', () => { expect(value).toBe(1); });",
				errors: [
					{
						messageId: "haveExpectAssertions",
						suggestions: [
							{
								desc: "Add `expect.assertions(1)`",
								output: "test('works', () => { expect.assertions(1);\nexpect(value).toBe(1); });",
							},
						],
					},
				],
			},
			{
				code: "test('works', () => { expect(first).toBe(1); expect(second).toBe(2); expect(third).toBe(3); });",
				errors: [
					{
						messageId: "haveExpectAssertions",
						suggestions: [
							{
								desc: "Add `expect.assertions(3)`",
								output: "test('works', () => { expect.assertions(3);\nexpect(first).toBe(1); expect(second).toBe(2); expect(third).toBe(3); });",
							},
						],
					},
				],
			},
			{
				code: "test('works', () => { for (const value of values) { expect(value).toBe(1); } });",
				errors: [
					{
						messageId: "haveExpectAssertions",
						suggestions: [
							{
								desc: "Add `expect.hasAssertions()`",
								output: "test('works', () => { expect.hasAssertions();\nfor (const value of values) { expect(value).toBe(1); } });",
							},
						],
					},
				],
			},
			{
				code: "test('works', () => { values.forEach(() => { expect(value).toBe(1); }); });",
				errors: [
					{
						messageId: "haveExpectAssertions",
						suggestions: [
							{
								desc: "Add `expect.hasAssertions()`",
								output: "test('works', () => { expect.hasAssertions();\nvalues.forEach(() => { expect(value).toBe(1); }); });",
							},
						],
					},
				],
			},
			{
				code: "test('works', () => { expect(value).toBe(1); values.forEach(() => { expect(other).toBe(2); }); });",
				errors: [
					{
						messageId: "haveExpectAssertions",
						suggestions: [
							{
								desc: "Add `expect.hasAssertions()`",
								output: "test('works', () => { expect.hasAssertions();\nexpect(value).toBe(1); values.forEach(() => { expect(other).toBe(2); }); });",
							},
						],
					},
				],
			},
			{
				code: "test('works', () => { expect.hasAssertions('argument'); expect(value).toBe(1); });",
				errors: [{ messageId: "hasAssertionsTakesNoArguments" }],
			},
			{
				code: "test('works', () => { expect.assertions(); expect(value).toBe(1); });",
				errors: [{ messageId: "assertionsRequiresOneArgument" }],
			},
			{
				code: "test('works', () => { expect.assertions('1'); expect(value).toBe(1); });",
				errors: [{ messageId: "assertionsRequiresNumberArgument" }],
			},
			{
				code: "test('works', () => { expect.assertions(...counts); expect(value).toBe(1); });",
				errors: [{ messageId: "assertionsRequiresNumberArgument" }],
			},
			{
				code: "it.skip('works', () => { expect(value).toBe(1); });",
				errors: [
					{
						messageId: "haveExpectAssertions",
						suggestions: [
							{
								desc: "Add `expect.assertions(1)`",
								output: "it.skip('works', () => { expect.assertions(1);\nexpect(value).toBe(1); });",
							},
						],
					},
				],
			},
			{
				code: "it('works', () => expect(value).toBe(1));",
				errors: [{ messageId: "haveExpectAssertions" }],
			},
			{
				code: "test.each([1, 2])('works', (value) => { expect(value).toBe(1); });",
				errors: [
					{
						messageId: "haveExpectAssertions",
						suggestions: [
							{
								desc: "Add `expect.assertions(1)`",
								output: "test.each([1, 2])('works', (value) => { expect.assertions(1);\nexpect(value).toBe(1); });",
							},
						],
					},
				],
			},
			{
				code: "test('works', async () => { expect(value).toBe(1); });",
				errors: [
					{
						messageId: "haveExpectAssertions",
						suggestions: [
							{
								desc: "Add `expect.assertions(1)`",
								output: "test('works', async () => { expect.assertions(1);\nexpect(value).toBe(1); });",
							},
						],
					},
				],
				options: [{ onlyFunctionsWithAsyncKeyword: true }],
			},
			{
				code: "test('works', () => { while (condition) { expect(value).toBe(1); } });",
				errors: [
					{
						messageId: "haveExpectAssertions",
						suggestions: [
							{
								desc: "Add `expect.hasAssertions()`",
								output: "test('works', () => { expect.hasAssertions();\nwhile (condition) { expect(value).toBe(1); } });",
							},
						],
					},
				],
				options: [{ onlyFunctionsWithExpectInLoop: true }],
			},
			{
				code: "test('works', () => { values.forEach(() => { expect(value).toBe(1); }); });",
				errors: [
					{
						messageId: "haveExpectAssertions",
						suggestions: [
							{
								desc: "Add `expect.hasAssertions()`",
								output: "test('works', () => { expect.hasAssertions();\nvalues.forEach(() => { expect(value).toBe(1); }); });",
							},
						],
					},
				],
				options: [{ onlyFunctionsWithExpectInCallback: true }],
			},
			{
				code: "test('works', () => { expect.hasAssertions(); expect(value).toBe(1); });",
				errors: [{ messageId: "preferAssertionsCount" }],
				output: "test('works', () => { expect.assertions(1); expect(value).toBe(1); });",
			},
			{
				code: "test('works', () => { expect.hasAssertions(); expect(value).toBe(1); expect(other).toBe(2); expect(third).toBe(3); });",
				errors: [{ messageId: "preferAssertionsCount" }],
				output: "test('works', () => { expect.assertions(3); expect(value).toBe(1); expect(other).toBe(2); expect(third).toBe(3); });",
			},
			{
				code: "test('works', () => { expect.hasAssertions(); expectRecord(value, 'x'); expectArray(items, 'x'); expectPresent(result, 'x'); });",
				errors: [{ messageId: "preferAssertionsCount" }],
				options: [{ additionalAssertionFunctions: ["expectRecord", "expectArray", "expectPresent"] }],
				output: "test('works', () => { expect.assertions(3); expectRecord(value, 'x'); expectArray(items, 'x'); expectPresent(result, 'x'); });",
			},
			{
				code: "test('works', () => { expect.hasAssertions(); try { expect(value).toBe(1); } finally { restore(); } });",
				errors: [{ messageId: "preferAssertionsCount" }],
				output: "test('works', () => { expect.assertions(1); try { expect(value).toBe(1); } finally { restore(); } });",
			},
		],
		valid: [
			{
				code: "test('works', () => { expect.assertions(1); expect(value).toBe(1); });",
			},
			{
				code: "test('works', () => { expect.assertions(2); expect(first).toBe(1); expect(second).toBe(2); });",
			},
			{
				code: "test('works', () => { expect.assertions(2); for (const value of values) { expect(value).toBe(1); } });",
			},
			{
				code: "test('works', () => { doSomething(); });",
			},
			{
				code: "it('works', () => { expect.assertions(1); expect(value).toBe(1); });",
			},
			{
				code: "it('works', () => expect(value).toBe(1));",
				options: [{ onlyFunctionsWithAsyncKeyword: true }],
			},
			{
				code: "test('works', () => { expect(value).toBe(1); });",
				options: [{ onlyFunctionsWithExpectInLoop: true }],
			},
			{
				code: "test('works', () => { expect(value).toBe(1); });",
				options: [{ onlyFunctionsWithExpectInCallback: true }],
			},
			{
				code: "describe('suite', () => { expect(value).toBe(1); });",
			},
			{
				code: "test('works', () => { expect.hasAssertions(); for (const value of values) { expect(value).toBe(1); } });",
			},
			{
				code: "test('works', () => { expect.hasAssertions(); try { expect(value).toBe(1); } catch { /* noop */ } });",
			},
			{
				code: "test('works', () => { expect.hasAssertions(); values.forEach(() => { expect(value).toBe(1); }); });",
			},
			// Vitest-style expectTypeOf not counted by default
			{
				code: "test('works', () => { expect.assertions(2); expectTypeOf(result).toBeString(); expect(value).toBe(1); });",
				options: [{ additionalExpectCallNames: ["expectTypeOf"] }],
			},
			{
				code: "test('works', () => { expect.assertions(2); expectTypeOf(result).toBeString(); expectTypeOf(other).toBeString(); });",
				options: [{ additionalExpectCallNames: ["expectTypeOf"] }],
			},
			{
				code: "test('works', () => { expect.assertions(2); expectTypeOf(result).toBeString(); expect(value).toBe(1); });",
				options: [{ additionalExpectCallNames: ["expectTypeOf", "assertType"] }],
			},
			{
				code: "test('works', () => expect(value).toBe(1));",
				options: [{ onlyFunctionsWithExpectInCallback: true }],
			},
		],
	});
});
