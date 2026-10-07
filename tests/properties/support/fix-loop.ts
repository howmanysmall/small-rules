import { applyFixes, fixer } from "@small-rules/rule-harness/fixes";
import { parseCase } from "@small-rules/rule-harness/parse";
import { isFix } from "@small-rules/rule-harness/types";

import type { createRuleExecutor } from "@small-rules/rule-harness/execute";
import type {
	Fix,
	HarnessDefinition,
	HarnessScope,
	HarnessSourceCode,
	NormalizedValidCase,
	Range,
	RuntimeDiagnostic,
} from "@small-rules/rule-harness/types";

/** Oxlint stops re-running fixes after this many passes. */
export const MAXIMUM_FIX_PASSES = 10;

type RuleExecutor = ReturnType<typeof createRuleExecutor>;

export interface FixLoopResult {
	readonly output: string;
	readonly passes: number;
	/**
	 * `settled` once no fixes remain, `invalid` when a pass produced code that
	 * does not compile, `stalled` when the fixes changed nothing, and
	 * `unsettled` when fixes remained after the last allowed pass.
	 */
	readonly status: "invalid" | "settled" | "stalled" | "unsettled";
}

/**
 * Applies every fix the rule reports, re-runs the rule on the output, and
 * repeats until no fixes remain or the pass budget runs out.
 *
 * Each diagnostic's fixes are applied atomically and a diagnostic whose fix
 * overlaps an earlier one waits for the next pass, as in Oxlint.
 *
 * @param execute - Runs the rule under test on a case.
 * @param testCase - The starting program, which must parse.
 * @returns How the loop ended, the last output, and the number of passes that
 *   applied fixes.
 */
export function runFixLoop(execute: RuleExecutor, testCase: NormalizedValidCase): FixLoopResult {
	let output = testCase.code;
	for (let passes = 0; passes <= MAXIMUM_FIX_PASSES; passes += 1) {
		const fixes = collectDiagnosticFixes(execute({ ...testCase, code: output }).diagnostics, output);
		if (fixes.length === 0) return { output, passes, status: "settled" };
		if (passes === MAXIMUM_FIX_PASSES) return { output, passes, status: "unsettled" };

		const next = applyFixes(output, fixes) ?? output;
		if (next === output) return { output, passes, status: "stalled" };
		if (!isValidProgram({ ...testCase, code: next })) {
			return { output: next, passes: passes + 1, status: "invalid" };
		}
		output = next;
	}

	/* v8 ignore next -- the loop always returns. @preserve */
	return { output, passes: MAXIMUM_FIX_PASSES, status: "unsettled" };
}

/**
 * Whether a program would be accepted by a compiler: it parses and it never
 * declares the same `let`, `const`, class, function, or import name twice in
 * one scope. The parser alone accepts such redeclarations.
 *
 * @param testCase - The program to check.
 * @returns `true` when the program is valid.
 */
export function isValidProgram(testCase: NormalizedValidCase): boolean {
	let sourceCode: HarnessSourceCode;
	try {
		sourceCode = parseCase(testCase);
	} catch {
		return false;
	}
	return !hasRedeclaration(sourceCode.scopeManager.globalScope);
}

function hasRedeclaration(globalScope: HarnessScope): boolean {
	const pending = [globalScope];
	for (let scope = pending.pop(); scope !== undefined; scope = pending.pop()) {
		for (const variable of scope.variables) {
			if (variable.defs.length > 1 && !variable.defs.every(isFunctionScopedDefinition)) return true;
		}
		for (const child of scope.childScopes) pending.push(child);
	}
	return false;
}

function isFunctionScopedDefinition(definition: HarnessDefinition): boolean {
	return definition.type === "Variable" && definition.parent?.kind === "var";
}

function collectDiagnosticFixes(diagnostics: ReadonlyArray<RuntimeDiagnostic>, text: string): Array<Fix> {
	const merged = new Array<Fix>();
	for (const diagnostic of diagnostics) {
		const result = diagnostic.fix?.(fixer);
		if (result === undefined) continue;
		const fix = mergeFixes(isFix.allows(result) ? [result] : result, text);
		if (fix !== undefined) merged.push(fix);
	}
	return merged;
}

function mergeFixes(fixes: ReadonlyArray<Fix>, text: string): Fix | undefined {
	if (fixes.length === 0) return undefined;

	let start = Number.POSITIVE_INFINITY;
	let end = Number.NEGATIVE_INFINITY;
	for (const { range } of fixes) {
		start = Math.min(start, range[0]);
		end = Math.max(end, range[1]);
	}

	const local = fixes.map(({ range, text: replacement }): Fix => {
		const shifted: Range = [range[0] - start, range[1] - start];
		return { range: shifted, text: replacement };
	});
	const range: Range = [start, end];
	return { range, text: applyFixes(text.slice(start, end), local) ?? "" };
}
