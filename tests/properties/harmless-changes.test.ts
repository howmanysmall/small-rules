import { describe, expect, it } from "vitest";
import { fc } from "@fast-check/vitest";

import smallRules from "$small-rules";
import { createRuleExecutor } from "$test/rule-harness/execute";

import { isValidProgram } from "./support/fix-loop";
import { FIXABLE_CASES } from "./support/fixable-cases";
import {
	lineSeparatorArbitrary,
	renameGeneratedIdentifiers,
	renameSuffixArbitrary,
	separateLines,
} from "./support/harmless-changes";

import type { RuleExecutionResult } from "$test/rule-harness/types";

const NUMBER_OF_RUNS = 100;
// A change that rarely alters the program makes the property pass vacuously.
const MINIMUM_ALTERED_RATIO = 0.5;

// Rules whose verdict depends only on code structure. Rules that read
// comments, directives, names, or the text between statements on purpose are
// left out, for example `no-commented-code`, `prevent-abbreviations`,
// `no-identity-map` (binding names), and `prefer-single-world-query-in-jecs`
// (only whitespace may separate the merged calls).
const STRUCTURAL_RULES = new Set<string>([
	"array-type-generic",
	"no-array-constructor-elements",
	"no-array-size-assignment",
	"no-color3-constructor",
	"no-increment-decrement",
	"prefer-idiv",
	"prefer-math-min-max",
	"prefer-sequence-overloads",
	"prefer-ternary-conditional-rendering",
	"prefer-udim2-shorthand",
	"require-switch-case-braces",
]);

const STRUCTURAL_CASES = FIXABLE_CASES.filter(({ rule }) => STRUCTURAL_RULES.has(rule));

describe("harmless changes", () => {
	it("should cover every listed structural rule", () => {
		// Catches a listed rule silently dropping out of these properties.
		expect.assertions(1);

		// Arrange
		const listed = [...STRUCTURAL_RULES];

		// Act
		const covered = STRUCTURAL_CASES.map(({ rule }) => rule);

		// Assert
		expect(covered.toSorted(compareText)).toStrictEqual(listed.toSorted(compareText));
	});

	it.each(STRUCTURAL_CASES)(
		"should report the same $rule messages when comments or blank lines separate statements",
		({ createCase, program, rule }) => {
			// Catches detection that breaks when a comment or blank line sits
			// between the statements it inspects.
			expect.hasAssertions();

			// Arrange
			const execute = createRuleExecutor(rule, smallRules.rules[rule]);
			let runs = 0;
			let altered = 0;

			fc.assert(
				fc.property(program, fc.array(lineSeparatorArbitrary, { minLength: 1 }), (code, separators) => {
					const original = createCase(code);
					fc.pre(isValidProgram(original));

					// Act
					const separatedCode = separateLines(code, separators);
					const separated = execute(createCase(separatedCode));
					runs += 1;
					altered += Number(separatedCode !== code);

					// Assert
					expect(getMessageIds(separated)).toStrictEqual(getMessageIds(execute(original)));
				}),
				{ numRuns: NUMBER_OF_RUNS },
			);

			// Assert
			expect(altered / runs).toBeGreaterThanOrEqual(MINIMUM_ALTERED_RATIO);
		},
	);

	it.each(STRUCTURAL_CASES)(
		"should report the same $rule messages when generated identifiers are renamed",
		({ createCase, program, rule }) => {
			// Catches detection that depends on what a user happened to name
			// their variables, parameters, or types.
			expect.hasAssertions();

			// Arrange
			const execute = createRuleExecutor(rule, smallRules.rules[rule]);
			let runs = 0;
			let altered = 0;

			fc.assert(
				fc.property(program, renameSuffixArbitrary, (code, suffix) => {
					const original = createCase(code);
					fc.pre(isValidProgram(original));

					// Act
					const renamedCode = renameGeneratedIdentifiers(original, suffix);
					const renamed = execute(createCase(renamedCode));
					runs += 1;
					altered += Number(renamedCode !== code);

					// Assert
					expect(getMessageIds(renamed)).toStrictEqual(getMessageIds(execute(original)));
				}),
				{ numRuns: NUMBER_OF_RUNS },
			);

			// Assert
			expect(altered / runs).toBeGreaterThanOrEqual(MINIMUM_ALTERED_RATIO);
		},
	);
});

// Helpers

function compareText(left: string, right: string): number {
	return left.localeCompare(right);
}

function getMessageIds({ diagnostics }: RuleExecutionResult): ReadonlyArray<string> {
	return diagnostics.map(({ messageId }) => messageId ?? "").toSorted(compareText);
}
