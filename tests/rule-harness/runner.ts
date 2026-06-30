import { describe, it } from "vitest";

import { assertInvalidCase, assertValidCase } from "./diagnostics";
import { createRuleExecutor } from "./execute";
import { normalizeCases } from "./parse";

import type {
	NormalizedCase,
	NormalizedInvalidCase,
	RuleTestCases,
	RuleTestRunner,
	RuleRunnerDefaults,
	RuleExecutionResult,
} from "./types";

const ONLY_TEST_KEY = "only";
const SKIP_TEST_KEY = "skip";

export function createRuleTester(defaults: RuleRunnerDefaults = {}): RuleTestRunner {
	return {
		run(ruleName, rule, cases): void {
			runRuleTests(ruleName, rule, cases, defaults);
		},
	};
}

function runRuleTests(ruleName: string, rule: unknown, cases: RuleTestCases, defaults: RuleRunnerDefaults = {}): void {
	const normalizedCases = normalizeCases(cases, defaults);
	const execute = createRuleExecutor(ruleName, rule);

	describe(ruleName, () => {
		for (const testCase of normalizedCases) registerCase(testCase, execute);
	});
}

function registerCase(testCase: NormalizedCase, execute: (testCase: NormalizedCase) => RuleExecutionResult): void {
	const name = createCaseName(testCase);
	function run(): void {
		const result = execute(testCase);
		if (testCase.kind === "valid") {
			assertValidCase(result.diagnostics, testCase.code);
			return;
		}
		assertInvalidCase(result.diagnostics, toInvalidCase(testCase), result.sourceCode);
	}
	if (testCase.only === true) {
		it[ONLY_TEST_KEY](name, run);
		return;
	}
	if (testCase.skip === true) {
		it[SKIP_TEST_KEY](name, run);
		return;
	}
	it(name, run);
}

function createCaseName(testCase: NormalizedCase): string {
	const prefix = testCase.kind === "valid" ? "valid" : "invalid";
	const compactCode = testCase.code.replaceAll(/\s+/gu, " ").trim();
	return `${prefix}: ${compactCode.slice(0, 80)}`;
}

function toInvalidCase(testCase: NormalizedInvalidCase): NormalizedInvalidCase {
	return testCase;
}
