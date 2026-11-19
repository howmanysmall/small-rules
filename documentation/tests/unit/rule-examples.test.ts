import nodePath from "node:path";
import { cwd } from "node:process";
import { describe, it } from "vitest";
import { Predicate } from "effect";
import { RuleTester } from "oxlint/plugins-dev";
import { walk } from "yuku-ast";
import { parse } from "yuku-parser";

import { ruleExamples } from "$data/rule-examples";
import { ruleManifest } from "$data/rule-manifest";
import smallRules from "$small-rules";
import { formatExampleSnippetAsync } from "$utilities/format-rule-example";

import type { Node, Program } from "yuku-parser";

import type { RuleExample } from "$utilities/extract-rule-examples";

interface RuleExampleCoverage {
	readonly name: string;
	readonly exemption: string | undefined;
	readonly invalidCount: number;
	readonly validCount: number;
}

interface FormattingMismatch {
	readonly actual: string;
	readonly expected: string;
	readonly label: string;
}

interface SnippetFormatTarget {
	readonly label: string;
	readonly language: string | undefined;
	readonly source: string;
}

type ExampleParseLanguage = "dts" | "js" | "jsx" | "ts" | "tsx";

type ExampleSourceType = Exclude<RuleTester.SourceType, "unambiguous">;

type OxlintRule = Parameters<RuleTester["run"]>[1];

type OxlintValidTestCase = RuleTester.ValidTestCase;

type OxlintOptions = NonNullable<OxlintValidTestCase["options"]>;

type OxlintSettings = NonNullable<OxlintValidTestCase["settings"]>;

type OxlintJsonValue = OxlintOptions[number];

type StaticValue = Exclude<RuleExample["options"], undefined>;

type StaticRecord = Extract<StaticValue, Readonly<Record<string, StaticValue>>>;

const LEADING_BLANK_LINE_PATTERN = /^[ \t]*\r?\n/u;
const TRAILING_BLANK_LINE_PATTERN = /\r?\n[ \t]*$/u;
const EXPECTED_DIAGNOSTIC_ERROR_PATTERN = /Should have no errors but had [1-9]\d*/u;

const collator = new Intl.Collator();
const workingDirectory = cwd();
const repositoryRoot = nodePath.resolve(
	workingDirectory,
	nodePath.basename(workingDirectory) === "documentation" ? ".." : ".",
);

function isMissingRequiredExamples({ exemption, invalidCount, validCount }: RuleExampleCoverage): boolean {
	return exemption === undefined && (invalidCount < 1 || validCount < 1);
}

function getRuleExampleCoverage(): ReadonlyArray<RuleExampleCoverage> {
	return ruleManifest.categories.flatMap((category) =>
		category.rules.map((entry): RuleExampleCoverage => {
			const examples = ruleExamples.get(entry.name) ?? [];
			return {
				name: entry.name,
				exemption: "exampleExemption" in entry ? entry.exampleExemption : undefined,
				invalidCount: examples.filter((example) => example.kind === "invalid").length,
				validCount: examples.filter((example) => example.kind === "valid").length,
			};
		}),
	);
}

function resolveExampleLanguage({ language }: RuleExample): ExampleParseLanguage {
	switch (language) {
		case "dts":
		case "js":
		case "jsx":
		case "ts":
		case "tsx":
			return language;

		default:
			return "ts";
	}
}

function resolveExampleSourceType({ sourceType }: RuleExample): ExampleSourceType {
	switch (sourceType) {
		case "commonjs":
		case "module":
		case "script":
			return sourceType;

		default:
			return "module";
	}
}

function parseExampleProgram(code: string, language: ExampleParseLanguage): Program | undefined {
	const primary = parse(code, { lang: language, sourceType: "module" });
	if (primary.diagnostics.length === 0) return primary.program;
	if (language === "tsx") return undefined;

	const fallback = parse(code, { lang: "tsx", sourceType: "module" });
	return fallback.diagnostics.length === 0 ? fallback.program : undefined;
}

function hasBlankEdgeLines(snippet: string): boolean {
	return LEADING_BLANK_LINE_PATTERN.test(snippet) || TRAILING_BLANK_LINE_PATTERN.test(snippet);
}

function isNonEmptyContainerNode(node: Node): boolean {
	switch (node.type) {
		case "BlockStatement":
		case "ClassBody":
		case "TSInterfaceBody":
			return node.body.length > 0;

		case "Program":
			return node.body.length >= 2;

		case "SwitchCase":
			return node.consequent.length > 0;

		case "TSEnumBody":
			return node.members.length > 0;

		default:
			return false;
	}
}

function isSquishedSingleLineSnippet(snippet: string, language: ExampleParseLanguage): boolean {
	if (snippet.includes("\n") || snippet.trim().length === 0) return false;

	const program = parseExampleProgram(snippet, language);
	if (program === undefined) return false;
	if (isNonEmptyContainerNode(program)) return true;

	let squished = false;
	walk(program, {
		enter(node) {
			if (isNonEmptyContainerNode(node)) {
				squished = true;
			}
		},
	});
	return squished;
}

function isMalformedExampleSnippet(snippet: string, language: ExampleParseLanguage): boolean {
	return hasBlankEdgeLines(snippet) || isSquishedSingleLineSnippet(snippet, language);
}

function hasNonEmptyStringOutput(output: RuleExample["output"]): output is string {
	return Predicate.isString(output) && output.length > 0;
}

function getMalformedExampleLabels(): ReadonlyArray<string> {
	const labels = new Array<string>();
	for (const [ruleName, examples] of ruleExamples) {
		for (const example of examples) {
			const language = resolveExampleLanguage(example);
			const baseLabel = `${ruleName}/${example.kind}/${example.id}`;
			if (isMalformedExampleSnippet(example.code, language)) {
				labels.push(baseLabel);
			}

			if (hasNonEmptyStringOutput(example.output) && isMalformedExampleSnippet(example.output, language)) {
				labels.push(`${baseLabel}#output`);
			}
		}
	}

	return labels.toSorted((left, right) => collator.compare(left, right));
}

function collectSnippetFormatTargets(): ReadonlyArray<SnippetFormatTarget> {
	const targets = new Array<SnippetFormatTarget>();
	for (const [ruleName, examples] of ruleExamples) {
		for (const example of examples) {
			if (example.preserveFormatting === true) continue;

			const baseLabel = `${ruleName}/${example.kind}/${example.id}`;
			targets.push({ label: baseLabel, language: example.language, source: example.code });

			if (hasNonEmptyStringOutput(example.output)) {
				targets.push({ label: `${baseLabel}#output`, language: example.language, source: example.output });
			}
		}
	}

	return targets;
}

async function getFormattingIdempotencyMismatchesAsync(): Promise<ReadonlyArray<FormattingMismatch>> {
	const results = await Promise.all(
		collectSnippetFormatTargets().map(
			async ({ label, language, source }): Promise<FormattingMismatch | undefined> => {
				const formatted = await formatExampleSnippetAsync(source, language);
				return formatted === source ? undefined : { actual: formatted, expected: source, label };
			},
		),
	);

	return results
		.filter((mismatch): mismatch is FormattingMismatch => mismatch !== undefined)
		.toSorted((left, right) => collator.compare(left.label, right.label));
}

function isOxlintRule(value: unknown): value is OxlintRule {
	return (
		Predicate.isObject(value) &&
		(("create" in value && Predicate.isFunction(value.create)) ||
			("createOnce" in value && Predicate.isFunction(value.createOnce)))
	);
}

function isStaticArray(value: StaticValue): value is ReadonlyArray<StaticValue> {
	return Array.isArray(value);
}

function isStaticRecord(value: StaticValue): value is StaticRecord {
	return Predicate.isObject(value) && !isStaticArray(value);
}

function toMutableJsonRecord(record: StaticRecord): OxlintSettings {
	return Object.fromEntries(
		Object.entries(record).map(([key, entry]): readonly [string, OxlintJsonValue] => [
			key,
			toMutableJsonValue(entry),
		]),
	);
}

function isJsonPrimitive(value: StaticValue): value is boolean | null | number | string {
	return value === null || Predicate.isBoolean(value) || Predicate.isNumber(value) || Predicate.isString(value);
}

function toMutableJsonValue(value: StaticValue): OxlintJsonValue {
	if (isJsonPrimitive(value)) return value;
	if (isStaticArray(value)) return value.map(toMutableJsonValue);

	return toMutableJsonRecord(value);
}

function toMutableOptions(options: RuleExample["options"]): OxlintOptions | undefined {
	if (options === undefined || !isStaticArray(options)) return undefined;
	return options.map(toMutableJsonValue);
}

function toMutableSettings(settings: RuleExample["settings"]): OxlintSettings | undefined {
	if (settings === undefined || !isStaticRecord(settings)) return undefined;
	return toMutableJsonRecord(settings);
}

function createOxlintValidTestCase(example: RuleExample): OxlintValidTestCase {
	const testCase: OxlintValidTestCase = {
		code: example.code,
		languageOptions: {
			env: { builtin: true },
			parserOptions: { lang: resolveExampleLanguage(example) },
			sourceType: resolveExampleSourceType(example),
		},
	};

	if (example.filename !== undefined) {
		testCase.filename = example.filename;
	}

	const options = toMutableOptions(example.options);
	if (options !== undefined) {
		testCase.options = options;
	}

	const settings = toMutableSettings(example.settings);
	if (settings !== undefined) {
		testCase.settings = settings;
	}

	return testCase;
}

function formatThrownError(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

function verifyExampleOutcome(
	tester: RuleTester,
	ruleName: string,
	rule: OxlintRule,
	example: RuleExample,
): ReadonlyArray<string> {
	const label = `${ruleName}/${example.kind}/${example.id}`;
	const testCase = createOxlintValidTestCase(example);
	const failures = new Array<string>();

	if (example.kind === "valid") {
		try {
			tester.run(ruleName, rule, { invalid: [], valid: [testCase] });
		} catch (error) {
			failures.push(`${label}: ${formatThrownError(error)}`);
		}

		return failures;
	}

	try {
		tester.run(ruleName, rule, { invalid: [], valid: [testCase] });
		failures.push(`${label}: expected invalid example to report at least one diagnostic, but it passed`);
	} catch (error) {
		const message = formatThrownError(error);
		if (!EXPECTED_DIAGNOSTIC_ERROR_PATTERN.test(message)) {
			failures.push(`${label}: unexpected error: ${message}`);
		}
	}

	if (Predicate.isString(example.output)) {
		try {
			tester.run(ruleName, rule, {
				invalid: [],
				valid: [{ ...testCase, code: example.output }],
			});
		} catch (error) {
			failures.push(`${label}#output: ${formatThrownError(error)}`);
		}
	}

	return failures;
}

function collectOxlintOutcomeFailures(): ReadonlyArray<string> {
	const tester = new RuleTester({
		cwd: repositoryRoot,
		eslintCompat: true,
	});
	const failures = new Array<string>();
	const originalDescribe = RuleTester.describe;
	const originalIt = RuleTester.it;

	RuleTester.describe = (_name, callback): void => {
		callback();
	};

	RuleTester.it = (_name, callback): void => {
		callback();
	};

	try {
		for (const [ruleName, examples] of ruleExamples) {
			const rule = smallRules.rules[ruleName];
			if (!isOxlintRule(rule)) {
				failures.push(`${ruleName}: exported rule does not match Oxlint Rule contract`);
				continue;
			}

			for (const example of examples) {
				for (const failure of verifyExampleOutcome(tester, ruleName, rule, example)) {
					failures.push(failure);
				}
			}
		}
	} finally {
		RuleTester.describe = originalDescribe;
		RuleTester.it = originalIt;
	}

	return failures.toSorted((left, right) => collator.compare(left, right));
}

describe("documented rule examples", () => {
	it("extracts at least one fail and one pass example for each non-exempt rule", ({ expect }) => {
		expect.assertions(1);

		const violations = getRuleExampleCoverage()
			.filter(isMissingRequiredExamples)
			.map(({ name }) => name);

		expect(violations).toStrictEqual([]);
	});

	it("rejects blank example exemptions", ({ expect }) => {
		expect.assertions(1);

		const blankExemptions = getRuleExampleCoverage()
			.filter(({ exemption }) => exemption?.trim().length === 0)
			.map(({ name }) => name);

		expect(blankExemptions).toStrictEqual([]);
	});

	it("keeps documented examples free of edge blank lines and squished containers", ({ expect }) => {
		expect.assertions(1);

		expect(getMalformedExampleLabels()).toStrictEqual([]);
	});

	it("formats documented examples idempotently with oxfmt", async ({ expect }) => {
		expect.assertions(1);

		const mismatches = await getFormattingIdempotencyMismatchesAsync();

		expect(mismatches).toStrictEqual([]);
	});

	it("preserves Oxlint rule outcomes across all formatted examples", ({ expect }) => {
		expect.assertions(1);

		expect(collectOxlintOutcomeFailures()).toStrictEqual([]);
	});
});
