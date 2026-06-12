import { describe } from "vitest";
import rule from "$oxc-rules/prefer-expect-assertions-count";

import { ts } from "./rule-testers";

describe("prefer-expect-assertions-count", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ts.run("prefer-expect-assertions-count", rule, {
		invalid: [
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
		],
		valid: [
			{
				code: "test('works', () => { expect.assertions(3); expect(value).toBe(1); expect(other).toBe(2); expect(third).toBe(3); });",
			},
		],
	});
});
