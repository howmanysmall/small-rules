import { parse, walk } from "yuku-parser";

import { decorateAst } from "./ast";
import { HarnessError } from "./harness-error";
import { createLocationIndex } from "./locations";
import { getObjectProperty, getProperty, isJsonSerializable, isRecord } from "./object";
import { createSourceCode } from "./source-code";

import type {
	BaseRuleCase,
	HarnessSourceCode,
	InvalidRuleCase,
	NormalizedCase,
	NormalizedInvalidCase,
	NormalizedRuleCase,
	NormalizedValidCase,
	RuleTestCases,
	RuleTestError,
	RuleRunnerDefaults,
	TestLanguage,
	ValidRuleCase,
} from "./types";

const DEFAULT_FILENAME_BY_LANGUAGE: Record<TestLanguage, string> = {
	dts: "case.d.ts",
	js: "case.js",
	jsx: "case.jsx",
	ts: "case.ts",
	tsx: "case.tsx",
};
const LEGACY_LANGUAGE_OPTIONS_KEY = ["language", "Options"].join("");
const LEGACY_PARSER_KEY = ["pars", "er"].join("");

export function normalizeCases(cases: RuleTestCases, defaults: RuleRunnerDefaults): Array<NormalizedCase> {
	const normalized = new Array<NormalizedCase>();
	let size = 0;

	for (const validCase of cases.valid) normalized[size++] = normalizeValidCase(validCase, defaults);
	for (const invalidCase of cases.invalid) normalized[size++] = normalizeInvalidCase(invalidCase, defaults);

	return normalized;
}

export function parseCase(testCase: NormalizedCase): HarnessSourceCode {
	const SOURCE_TYPE_MAP: Record<string, "module" | "script"> = {
		commonjs: "script",
		module: "module",
		script: "script",
		unambiguous: "module",
	};
	const sourceType = SOURCE_TYPE_MAP[testCase.sourceType] ?? "module";
	const parseResult = parse(testCase.code, {
		lang: testCase.language,
		sourceType,
	});

	if (parseResult.diagnostics.length > 0) {
		const [error0] = parseResult.diagnostics;
		const error = new HarnessError(error0?.message ?? "Yuku parser failed to parse test case.", { cause: error0 });
		Error.captureStackTrace(error, parseCase);
		throw error;
	}

	// Yuku nodes have start/end (byte offsets) instead of range/loc.
	// Normalize by adding range: [start, end] to every node and comment.
	walk(parseResult.program, {
		enter(node) {
			Object.assign(node, { range: [node.start, node.end] });
		},
	});
	for (const comment of parseResult.comments) {
		Object.assign(comment, { range: [comment.start, comment.end] });
	}

	const locationIndex = createLocationIndex(testCase.code);
	const ast = decorateAst(parseResult.program, locationIndex);
	return createSourceCode(testCase.code, ast, parseResult.comments);
}

function normalizeValidCase(input: string | ValidRuleCase, defaults: RuleRunnerDefaults): NormalizedValidCase {
	const base = typeof input === "string" ? { code: input } : input;
	return { ...normalizeBaseCase(base, defaults), kind: "valid" };
}

function normalizeInvalidCase(input: InvalidRuleCase, defaults: RuleRunnerDefaults): NormalizedInvalidCase {
	const normalized: NormalizedInvalidCase = {
		...normalizeBaseCase(input, defaults),
		errors: normalizeErrors(input.errors),
		kind: "invalid",
	};
	if ("output" in input && input.output !== undefined) return { ...normalized, output: input.output };
	return normalized;
}

function normalizeBaseCase(input: BaseRuleCase, defaults: RuleRunnerDefaults): NormalizedRuleCase {
	rejectLegacyLanguageOptions(input);
	const language = resolveLanguage(input, defaults);
	const filename = input.filename ?? DEFAULT_FILENAME_BY_LANGUAGE[language];
	const sourceType = input.sourceType ?? defaults.sourceType ?? "module";
	const options = input.options ?? [];
	const settings = input.settings ?? {};
	assertJsonSerializable("options", options);
	assertJsonSerializable("settings", settings);

	const normalized: NormalizedRuleCase = {
		code: input.code,
		filename,
		language,
		options,
		settings,
		sourceType,
	};
	if (input.only !== undefined) normalized.only = input.only;
	if (input.skip !== undefined) normalized.skip = input.skip;
	return normalized;
}

function rejectLegacyLanguageOptions(input: BaseRuleCase): void {
	const legacyOptions = getObjectProperty(input, LEGACY_LANGUAGE_OPTIONS_KEY);
	if (legacyOptions === undefined) return;
	if (LEGACY_PARSER_KEY in legacyOptions) {
		const error = new HarnessError("Legacy parser configuration is not supported by the Oxc-native rule tester.");
		Error.captureStackTrace(error, rejectLegacyLanguageOptions);
		throw error;
	}
	const error = new HarnessError(
		"Legacy language options are not supported. Use top-level language and sourceType test fields.",
	);
	Error.captureStackTrace(error, rejectLegacyLanguageOptions);
	throw error;
}

function resolveLanguage(input: BaseRuleCase, defaults: RuleRunnerDefaults): TestLanguage {
	if (input.language !== undefined) return input.language;
	return defaults.language ?? languageFromFilename(input.filename);
}

function languageFromFilename(filename = ""): TestLanguage {
	if (filename.endsWith(".d.ts")) return "dts";
	if (filename.endsWith(".tsx")) return "tsx";
	if (filename.endsWith(".ts")) return "ts";
	if (filename.endsWith(".jsx")) return "jsx";
	return "js";
}

function assertJsonSerializable(name: string, value: unknown): void {
	if (isJsonSerializable(value)) return;
	const error = new HarnessError(`${name} must be JSON-serializable.`);
	Error.captureStackTrace(error, assertJsonSerializable);
	throw error;
}

export function getRuleMeta(rule: unknown): Record<string, unknown> {
	const meta = getProperty(rule, "meta");
	return isRecord(meta) ? meta : {};
}

function normalizeErrors(errors: number | ReadonlyArray<RuleTestError>): ReadonlyArray<RuleTestError> {
	if (typeof errors !== "number") return errors;
	return Array.from({ length: errors }, () => ({}));
}
