import { deepEqual, equal } from "node:assert/strict";
import { expect } from "vitest";

import { applyFixes, fixer } from "./fixes";
import { HarnessError } from "./harness-error";
import { getArrayProperty, getObjectProperty, getProperty, getStringProperty, isRecord } from "./object";

import type {
	FixProvider,
	Fix,
	HarnessNode,
	HarnessSourceCode,
	NormalizedInvalidCase,
	RuleTestError,
	RuleTestSuggestion,
	RuntimeDiagnostic,
	RuntimeSuggestion,
	SourceLocation,
} from "./types";

export function createDiagnosticCollector(meta: Record<string, unknown>): {
	diagnostics: Array<RuntimeDiagnostic>;
	report: (diagnostic: unknown) => void;
} {
	const diagnostics = new Array<RuntimeDiagnostic>();
	return {
		diagnostics,
		report(diagnostic): void {
			diagnostics.push(normalizeDiagnostic(diagnostic, meta));
		},
	};
}

export function assertValidCase(diagnostics: ReadonlyArray<RuntimeDiagnostic>, code: string): void {
	expect(diagnostics, `Expected no diagnostics for:\n${code}`).toHaveLength(0);
}

export function assertInvalidCase(
	diagnostics: ReadonlyArray<RuntimeDiagnostic>,
	testCase: NormalizedInvalidCase,
	sourceCode: HarnessSourceCode,
): void {
	expect(diagnostics, `Expected ${testCase.errors.length} diagnostics for:\n${testCase.code}`).toHaveLength(
		testCase.errors.length,
	);

	for (let index = 0; index < testCase.errors.length; index += 1) {
		const expected = testCase.errors[index];
		const actual = diagnostics[index];
		if (expected === undefined || actual === undefined) continue;
		assertDiagnostic(actual, expected, sourceCode);
	}

	assertAutofixOutput(diagnostics, testCase, sourceCode);
}

function normalizeDiagnostic(diagnostic: unknown, meta: Record<string, unknown>): RuntimeDiagnostic {
	if (!isRecord(diagnostic)) {
		const error = new HarnessError("context.report() received a non-object diagnostic.");
		Error.captureStackTrace(error, normalizeDiagnostic);
		throw error;
	}

	const messageId = getStringProperty(diagnostic, "messageId");
	const data = getDiagnosticData(diagnostic);
	const message = getStringProperty(diagnostic, "message") ?? renderMessage(meta, messageId, data);
	const node = getNodeProperty(diagnostic, "node");
	const loc = getLocationProperty(diagnostic) ?? node?.loc;
	const fix = getFixProvider(diagnostic, "fix");
	const suggestions = normalizeSuggestions(diagnostic, meta);

	const normalized: RuntimeDiagnostic = {
		data,
		message,
		suggestions,
	};
	if (fix !== undefined) normalized.fix = fix;
	if (loc !== undefined) {
		normalized.column = loc.start.column + 1;
		normalized.endColumn = loc.end.column + 1;
		normalized.endLine = loc.end.line;
		normalized.line = loc.start.line;
		normalized.loc = loc;
	}
	if (messageId !== undefined) normalized.messageId = messageId;
	if (node !== undefined) normalized.node = node;
	return normalized;
}

function normalizeSuggestions(
	diagnostic: Record<string, unknown>,
	meta: Record<string, unknown>,
): Array<RuntimeSuggestion> {
	const suggestions = getArrayProperty(diagnostic, "suggest");
	if (suggestions === undefined) return [];

	const normalized = new Array<RuntimeSuggestion>();
	let size = 0;
	for (const suggestion of suggestions) {
		if (!isRecord(suggestion)) continue;
		const messageId = getStringProperty(suggestion, "messageId");
		const data = getDiagnosticData(suggestion);
		const normalizedSuggestion: RuntimeSuggestion = {
			data,
			desc:
				getStringProperty(suggestion, "desc") ??
				getStringProperty(suggestion, "message") ??
				renderMessage(meta, messageId, data),
		};
		const fix = getFixProvider(suggestion, "fix");
		if (fix !== undefined) normalizedSuggestion.fix = fix;
		if (messageId !== undefined) normalizedSuggestion.messageId = messageId;
		normalized[size++] = normalizedSuggestion;
	}
	return normalized;
}

function assertDiagnostic(actual: RuntimeDiagnostic, expected: RuleTestError, sourceCode: HarnessSourceCode): void {
	if (expected.messageId !== undefined) equal(actual.messageId, expected.messageId);
	if (expected.message !== undefined) equal(actual.message, expected.message);
	if (expected.data !== undefined) deepEqual(actual.data, expected.data);
	if (expected.line !== undefined) equal(actual.line, expected.line);
	if (expected.column !== undefined) equal(actual.column, expected.column);
	if (expected.endLine !== undefined) equal(actual.endLine, expected.endLine);
	if (expected.endColumn !== undefined) equal(actual.endColumn, expected.endColumn);
	if (expected.suggestions !== undefined) assertSuggestions(actual, expected.suggestions, sourceCode.text);
}

function assertSuggestions(
	actual: RuntimeDiagnostic,
	expected: number | ReadonlyArray<RuleTestSuggestion>,
	sourceText: string,
): void {
	if (typeof expected === "number") {
		equal(actual.suggestions.length, expected);
		return;
	}

	expect(actual.suggestions).toHaveLength(expected.length);
	for (let index = 0; index < expected.length; index += 1) {
		const expectedSuggestion: RuleTestSuggestion | undefined = expected[index];
		const actualSuggestion: RuntimeSuggestion | undefined = actual.suggestions[index];
		if (expectedSuggestion === undefined || actualSuggestion === undefined) continue;
		if (expectedSuggestion.messageId !== undefined) equal(actualSuggestion.messageId, expectedSuggestion.messageId);
		if (expectedSuggestion.desc !== undefined) equal(actualSuggestion.desc, expectedSuggestion.desc);
		if (expectedSuggestion.message !== undefined) equal(actualSuggestion.desc, expectedSuggestion.message);
		if (expectedSuggestion.data !== undefined) deepEqual(actualSuggestion.data, expectedSuggestion.data);
		if (expectedSuggestion.output !== undefined) {
			equal(applyFixesToProvider(actualSuggestion.fix, sourceText), expectedSuggestion.output);
		}
	}
}

function assertAutofixOutput(
	diagnostics: ReadonlyArray<RuntimeDiagnostic>,
	testCase: NormalizedInvalidCase,
	sourceCode: HarnessSourceCode,
): void {
	if (!("output" in testCase)) return;
	const fixes = collectFixes(diagnostics);
	const fixedOutput = fixes.length === 0 ? undefined : applyFixes(sourceCode.text, fixes);
	if (testCase.output === null) {
		equal(fixedOutput, undefined);
		return;
	}
	expect(fixedOutput).toBe(testCase.output);
}

function applyFixesToProvider(provider: FixProvider | undefined, sourceCode: string | undefined): string | undefined {
	if (sourceCode === undefined) return undefined;
	return applyFixes(sourceCode, runFixProvider(provider));
}

function runFixProvider(provider: FixProvider | undefined): ReturnType<FixProvider> {
	if (provider === undefined) return undefined;
	return provider(fixer);
}

function collectFixes(diagnostics: ReadonlyArray<RuntimeDiagnostic>): Array<Fix> {
	const fixes = new Array<Fix>();
	for (const diagnostic of diagnostics) {
		const fixResult = runFixProvider(diagnostic.fix);
		if (fixResult === undefined) continue;
		if (Array.isArray(fixResult)) {
			for (const fix of fixResult) {
				if (isFix(fix)) fixes.push(fix);
			}
			continue;
		}
		if (isFix(fixResult)) fixes.push(fixResult);
	}
	return fixes;
}

function getDiagnosticData(diagnostic: Record<string, unknown>): Record<string, unknown> {
	const data = getObjectProperty(diagnostic, "data");
	return data ?? {};
}

function getFixProvider(diagnostic: Record<string, unknown>, key: string): FixProvider | undefined {
	const fix = getProperty(diagnostic, key);
	return isFixProvider(fix) ? fix : undefined;
}

function isFixProvider(value: unknown): value is FixProvider {
	return typeof value === "function";
}

function getNodeProperty(diagnostic: Record<string, unknown>, key: string): HarnessNode | undefined {
	const node = getProperty(diagnostic, key);
	return isHarnessNodeLike(node) ? node : undefined;
}

function isHarnessNodeLike(value: unknown): value is HarnessNode {
	return isRecord(value) && typeof value.type === "string" && Array.isArray(value.range) && isRecord(value.loc);
}

function isFix(value: unknown): value is Fix {
	if (!isRecord(value)) return false;
	const { range } = value;
	if (!Array.isArray(range) || range.length !== 2 || typeof value.text !== "string") return false;
	const [start, end] = range;
	return typeof start === "number" && typeof end === "number";
}

function getLocationProperty(diagnostic: Record<string, unknown>): SourceLocation | undefined {
	const loc = getObjectProperty(diagnostic, "loc");
	if (loc === undefined) return undefined;
	const start = getObjectProperty(loc, "start");
	const end = getObjectProperty(loc, "end");
	if (start === undefined || end === undefined) return undefined;
	if (
		typeof start.line !== "number" ||
		typeof start.column !== "number" ||
		typeof end.line !== "number" ||
		typeof end.column !== "number"
	) {
		return undefined;
	}
	return {
		end: { column: end.column, line: end.line },
		start: { column: start.column, line: start.line },
	};
}

function renderMessage(
	meta: Record<string, unknown>,
	messageId: string | undefined,
	data: Record<string, unknown>,
): string {
	if (messageId === undefined) return "";
	const messages = getObjectProperty(meta, "messages");
	const template = messages === undefined ? undefined : getStringProperty(messages, messageId);
	if (template === undefined) return messageId;
	return template.replaceAll(/\{\{(?<key>[^}]+)\}\}/gu, (_match, key: string) => {
		const value = data[key.trim()];
		return formatMessageValue(value);
	});
}

function formatMessageValue(value: unknown): string {
	if (value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return value.toString();
	return JSON.stringify(value) ?? "";
}
