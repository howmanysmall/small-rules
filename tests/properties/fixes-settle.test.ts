import { describe, expect, it } from "vitest";
import { fc } from "@fast-check/vitest";

import smallRules from "$small-rules";
import { createRuleExecutor } from "$test/rule-harness/execute";

import { isValidProgram, runFixLoop } from "./support/fix-loop";
import { FIXABLE_CASES } from "./support/fixable-cases";

const NUMBER_OF_RUNS = 100;
// A generator that rarely triggers its rule makes the property pass
// vacuously, so most generated programs must receive at least one fix.
const MINIMUM_TRIGGER_RATIO = 0.5;

describe("fixable rules", () => {
	it("should cover every rule that declares meta.fixable", () => {
		// Catches a new fixable rule shipping without a settling property.
		expect.assertions(1);

		// Arrange
		const fixableRules = Object.entries(smallRules.rules)
			.filter(([, rule]) => rule.meta?.fixable !== undefined)
			.map(([name]) => name);

		// Act
		const covered = FIXABLE_CASES.map(({ rule }) => rule);

		// Assert
		expect(covered.toSorted(compareText)).toStrictEqual(fixableRules.toSorted(compareText));
	});

	it.each(FIXABLE_CASES)(
		"should settle $rule fixes into valid code within the pass limit",
		({ createCase, program, rule }) => {
			// Catches fixes that undo each other, re-trigger forever, report a
			// fix that changes nothing, or leave code that no longer compiles.
			expect.hasAssertions();

			// Arrange
			const execute = createRuleExecutor(rule, smallRules.rules[rule]);
			let runs = 0;
			let triggered = 0;

			// Act
			fc.assert(
				fc.property(program, (code) => {
					const testCase = createCase(code);
					fc.pre(isValidProgram(testCase));
					const { output, passes, status } = runFixLoop(execute, testCase);
					runs += 1;
					triggered += Math.min(passes, 1);

					// Assert
					expect({ output, status }).toStrictEqual({ output, status: "settled" });
				}),
				{ numRuns: NUMBER_OF_RUNS },
			);

			// Assert
			expect(triggered / runs).toBeGreaterThanOrEqual(MINIMUM_TRIGGER_RATIO);
		},
	);
});

// Helpers

function compareText(left: string, right: string): number {
	return left.localeCompare(right);
}
