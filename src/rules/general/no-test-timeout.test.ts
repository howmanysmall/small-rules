import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/general/no-test-timeout";

const TIMEOUT_ERROR = [{ messageId: "noTestTimeout" }];
const CUSTOM_FUNCTIONS = [{ additionalTestFunctions: ["scenario"] }];

describe("no-test-timeout", () => {
	ts.run("no-test-timeout", rule, {
		invalid: [
			{
				code: "test('loads the config', async () => {}, 5000);",
				errors: [{ messageId: "noTestTimeout" }],
				documentation: { id: "fail", title: "Timeout argument on a test" },
			},
			{ code: "it('name', function () {}, TIMEOUT);", errors: TIMEOUT_ERROR },
			{ code: "it('name', runCase, 5000);", errors: TIMEOUT_ERROR },
			{ code: "it('name', () => {}, TIMEOUT);", errors: TIMEOUT_ERROR },
			{ code: "xit('name', () => {}, 5000);", errors: TIMEOUT_ERROR },
			{ code: "fit('name', () => {}, 5000);", errors: TIMEOUT_ERROR },
			{ code: "xtest('name', () => {}, 5000);", errors: TIMEOUT_ERROR },
			{ code: "test.only('name', () => {}, 5000);", errors: TIMEOUT_ERROR },
			{ code: "test.concurrent.skip('name', () => {}, 5000);", errors: TIMEOUT_ERROR },
			{ code: "test('name', { timeout: 1000 }, () => {});", errors: TIMEOUT_ERROR },
			{ code: "test('name', () => {}, { retry: 2, timeout: 1000 });", errors: TIMEOUT_ERROR },
			{ code: "test('name', { 'timeout': 1000 }, () => {});", errors: TIMEOUT_ERROR },
			{ code: "test.each([1, 2])('case %s', () => {}, 5000);", errors: TIMEOUT_ERROR },
			{ code: "it.skip.each([1])('case %s', { timeout: 1000 }, () => {});", errors: TIMEOUT_ERROR },
			{ code: "test.for([1])('case %s', { timeout: 1000 }, () => {});", errors: TIMEOUT_ERROR },
			{ code: "test.each`a\n1`('case $a', () => {}, 5000);", errors: TIMEOUT_ERROR },
			{ code: "describe('group', { timeout: 1000 }, () => {});", errors: TIMEOUT_ERROR },
			{ code: "describe.each([1])('group %s', { timeout: 1000 }, () => {});", errors: TIMEOUT_ERROR },
			{ code: "test.fails('name', () => {}, 5000);", errors: TIMEOUT_ERROR },
			{ code: "describe.shuffle('group', { timeout: 1000 }, () => {});", errors: TIMEOUT_ERROR },
			{ code: "it.skipIf(cond)('name', () => {}, 5000);", errors: TIMEOUT_ERROR },
			{ code: "test.runIf(cond)('name', () => {}, 5000);", errors: TIMEOUT_ERROR },
			{ code: "describe.skipIf(cond)('group', { timeout: 1 }, () => {});", errors: TIMEOUT_ERROR },
			{ code: "it.concurrent.skipIf(cond)('name', () => {}, 5000);", errors: TIMEOUT_ERROR },
			{ code: "scenario('name', () => {}, 5000);", options: CUSTOM_FUNCTIONS, errors: TIMEOUT_ERROR },
			{
				code: "scenario.only('name', { timeout: 1 }, () => {});",
				options: CUSTOM_FUNCTIONS,
				errors: TIMEOUT_ERROR,
			},
		],
		valid: [
			{
				code: "test('loads the config', async () => {});",
				documentation: { id: "pass", title: "Test without a timeout" },
			},
			"test('name', options, run);",
			"it('name', runCase, TIMEOUT);",
			"it.skipIf(cond)('name', () => {});",
			"test('name', { retry: 2 }, () => {});",
			"test('name', () => {}, { retry: 2 });",
			"test('name', { [key]: 1, ...rest }, () => {});",
			"test.todo('name');",
			"test.each([1])('case %s', () => {});",
			"describe('group', () => {});",
			"beforeEach(() => {}, 5000);",
			"afterAll(() => {}, 5000);",
			"waitFor(() => {}, { timeout: 1000 });",
			"vi.waitFor(() => {}, { timeout: 1000 });",
			"screen.findByText('x', {}, { timeout: 1000 });",
			"runner.test('name', () => {}, 5000);",
			"test.extend({})('name', () => {}, 5000);",
			"test[name]('name', () => {}, 5000);",
			"other.each([1])('case', () => {}, 5000);",
			"setup()('name', () => {}, 5000);",
			"test.each[0]`a`('name', () => {}, 5000);",
			"tag`a`('name', () => {}, 5000);",
			"scenario('name', () => {}, 5000);",
		],
	});
});
