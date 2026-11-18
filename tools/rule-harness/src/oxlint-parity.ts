import { cwd } from "node:process";
import { describe, it } from "vitest";
import { Predicate } from "effect";
import { RuleTester } from "oxlint/plugins-dev";

import { getProperty, isJsonSerializable } from "./object";

import type { HarnessValue } from "./object";
import type {
	BaseRuleCase,
	InvalidRuleCase,
	RuleRunnerDefaults,
	RuleTestCases,
	RuleTestError,
	RuleTestSuggestion,
	ValidRuleCase,
} from "./types";

type OxlintRule = Parameters<RuleTester["run"]>[1];

type OxlintValidCase = RuleTester.ValidTestCase;

type OxlintInvalidCase = RuleTester.InvalidTestCase;

type OxlintError = RuleTester.Error;

type OxlintSuggestion = RuleTester.ErrorSuggestion;

type OxlintData = NonNullable<OxlintError["data"]>;

type OxlintOptions = NonNullable<OxlintValidCase["options"]>;

type OxlintSettings = NonNullable<OxlintValidCase["settings"]>;

export interface OxlintParityCases {
	/** How many cases carry a `harnessOnly` reason and were left out. */
	readonly harnessOnlyCount: number;
	readonly tests: RuleTester.TestCases;
}

const ONLY_TEST_KEY = "only";

RuleTester.describe = (text, callback): void => {
	// biome-ignore lint/nursery/useValidTestTitle: it is a string lol
	describe(text, callback);
};

RuleTester.it = (text, callback): void => {
	// biome-ignore lint/nursery/useValidTestTitle: it is a string lol
	it(text, callback);
};

RuleTester.itOnly = (text, callback): void => {
	it[ONLY_TEST_KEY](text, callback);
};

/**
 * Runs the same cases a second time through Oxlint's own `RuleTester`, which
 * parses, analyses scope, and applies fixes the way the `oxlint` binary does.
 * A case that passes in the harness and fails here is a rule that works in
 * tests and misbehaves in production.
 */
export function runOxlintParity(
	ruleName: string,
	rule: HarnessValue,
	cases: RuleTestCases,
	defaults: RuleRunnerDefaults,
): void {
	if (defaults.oxlintParity === false || !isOxlintRule(rule)) return;

	const { tests } = toOxlintParityCases(cases);
	if (tests.valid.length === 0 && tests.invalid.length === 0) return;

	const tester = new RuleTester({
		cwd: cwd(),
		eslintCompat: true,
		languageOptions: {
			// The `oxlint` binary knows the ECMAScript built-ins by default;
			// the RuleTester starts with no globals at all.
			env: { builtin: true },
			parserOptions: { lang: defaults.language ?? "js" },
			sourceType: defaults.sourceType ?? "module",
		},
	});

	describe(`${ruleName} (oxlint parity)`, () => {
		tester.run(ruleName, rule, tests);
	});
}

export function toOxlintParityCases(cases: RuleTestCases): OxlintParityCases {
	const valid = new Array<OxlintValidCase | string>();
	const invalid = new Array<OxlintInvalidCase>();
	let harnessOnlyCount = 0;

	for (const validCase of cases.valid) {
		if (Predicate.isString(validCase)) {
			valid.push(validCase);
			continue;
		}

		if (validCase.harnessOnly !== undefined) {
			harnessOnlyCount += 1;
		}

		if (!shouldRunUnderOxlint(validCase)) continue;

		valid.push(toOxlintBaseCase(validCase));
	}

	for (const invalidCase of cases.invalid) {
		if (invalidCase.harnessOnly !== undefined) {
			harnessOnlyCount += 1;
		}

		if (!shouldRunUnderOxlint(invalidCase)) continue;

		invalid.push(toOxlintInvalidCase(invalidCase));
	}

	return { harnessOnlyCount, tests: { invalid, valid } };
}

function isOxlintRule(rule: HarnessValue): rule is OxlintRule {
	return Predicate.isFunction(getProperty(rule, "create")) || Predicate.isFunction(getProperty(rule, "createOnce"));
}

function isOxlintOptions(options: HarnessValue): options is OxlintOptions {
	return Array.isArray(options) && isJsonSerializable(options);
}

function isOxlintSettings(settings: HarnessValue): settings is OxlintSettings {
	return Predicate.isObject(settings) && !Array.isArray(settings) && isJsonSerializable(settings);
}

function shouldRunUnderOxlint(testCase: BaseRuleCase): boolean {
	return testCase.harnessOnly === undefined && testCase.skip !== true;
}

function toOxlintBaseCase(testCase: ValidRuleCase): OxlintValidCase {
	const converted: OxlintValidCase = { code: testCase.code };

	if (testCase.filename !== undefined) {
		converted.filename = testCase.filename;
	}

	if (testCase.only !== undefined) {
		converted.only = testCase.only;
	}

	if (isOxlintOptions(testCase.options)) {
		converted.options = testCase.options;
	}

	if (isOxlintSettings(testCase.settings)) {
		converted.settings = testCase.settings;
	}

	if (testCase.globals !== undefined || testCase.language !== undefined || testCase.sourceType !== undefined) {
		converted.languageOptions = {};

		if (testCase.globals !== undefined) {
			converted.languageOptions.globals = { ...testCase.globals };
		}

		if (testCase.language !== undefined) {
			converted.languageOptions.parserOptions = { lang: testCase.language };
		}

		if (testCase.sourceType !== undefined) {
			converted.languageOptions.sourceType = testCase.sourceType;
		}
	}

	return converted;
}

function toOxlintInvalidCase(testCase: InvalidRuleCase): OxlintInvalidCase {
	const converted: OxlintInvalidCase = { ...toOxlintBaseCase(testCase), errors: toOxlintErrors(testCase.errors) };

	if ("output" in testCase) {
		converted.output = testCase.output;
	}

	return converted;
}

function toOxlintErrors(errors: InvalidRuleCase["errors"]): OxlintInvalidCase["errors"] {
	if (Predicate.isNumber(errors)) return errors;

	const converted = new Array<OxlintError>();

	for (const error of errors) {
		const oxlintError = toOxlintError(error);
		// Oxlint needs a message or a message id on every expected error, so a
		// case that only pins positions falls back to its error count.
		if (oxlintError === undefined) return errors.length;

		converted.push(oxlintError);
	}

	return converted;
}

function toOxlintError(error: RuleTestError): OxlintError | undefined {
	const converted = toIdentifiedError(error);
	if (converted === undefined) return undefined;

	if (error.line !== undefined) {
		converted.line = error.line;
	}

	if (error.column !== undefined) {
		converted.column = error.column;
	}

	if (error.endLine !== undefined) {
		converted.endLine = error.endLine;
	}

	if (error.endColumn !== undefined) {
		converted.endColumn = error.endColumn;
	}

	const data = toOxlintData(error.data);
	if (data !== undefined) {
		converted.data = data;
	}

	const suggestions = toOxlintSuggestions(error.suggestions);
	if (suggestions !== undefined) {
		converted.suggestions = suggestions;
	}

	return converted;
}

function toIdentifiedError({ message, messageId }: RuleTestError): OxlintError | undefined {
	if (messageId !== undefined) return message === undefined ? { messageId } : { message, messageId };

	return message === undefined ? undefined : { message };
}

function toOxlintData(data: RuleTestError["data"]): OxlintData | undefined {
	if (data === undefined) return undefined;

	const converted: OxlintData = {};

	for (const [key, value] of Object.entries(data)) {
		if (!isMessageDataValue(value)) return undefined;

		converted[key] = value;
	}

	return converted;
}

function isMessageDataValue(value: HarnessValue): value is OxlintData[string] {
	return (
		value === null ||
		value === undefined ||
		Predicate.isString(value) ||
		Predicate.isNumber(value) ||
		Predicate.isBoolean(value) ||
		Predicate.isBigInt(value)
	);
}

function toOxlintSuggestions(suggestions: RuleTestError["suggestions"]): Array<OxlintSuggestion> | undefined {
	if (suggestions === undefined || Predicate.isNumber(suggestions)) return undefined;

	const converted = new Array<OxlintSuggestion>();

	for (const suggestion of suggestions) {
		const oxlintSuggestion = toOxlintSuggestion(suggestion);
		// Oxlint needs the output of every expected suggestion; without it
		// the suggestions on this error go unchecked here.
		if (oxlintSuggestion === undefined) return undefined;

		converted.push(oxlintSuggestion);
	}

	return converted;
}

function toOxlintSuggestion(suggestion: RuleTestSuggestion): OxlintSuggestion | undefined {
	if (suggestion.output === undefined) return undefined;

	const converted: OxlintSuggestion = { output: suggestion.output };

	const description = suggestion.desc ?? suggestion.message;
	if (description !== undefined) {
		converted.desc = description;
	}

	if (suggestion.messageId !== undefined) {
		converted.messageId = suggestion.messageId;
	}

	const data = toOxlintData(suggestion.data);
	if (data !== undefined) {
		converted.data = data;
	}

	return converted;
}
