// oxlint-disable unicorn/no-null -- The unset scope mirrors eslint-scope's null upper scope sentinel.
import { traverseAst } from "./ast";
import { createDiagnosticCollector } from "./diagnostics";
import { throwHarnessError } from "./errors";
import { getProperty, isRecord } from "./object";
import { getRuleMeta, parseCase } from "./parse";

import type {
	HarnessContext,
	HarnessNode,
	HarnessSourceCode,
	NormalizedCase,
	RuleExecutionResult,
	RuntimeDiagnostic,
} from "./types";

interface MutableHarnessContext extends HarnessContext {
	diagnostics: ReturnType<typeof createDiagnosticCollector>;
}

export function createRuleExecutor(ruleName: string, rule: unknown): (testCase: NormalizedCase) => RuleExecutionResult {
	const meta = getRuleMeta(rule);
	const createOnce = getRuleFunction(rule, "createOnce");
	if (createOnce !== undefined) {
		const context = createMutableContext(ruleName);
		const visitor = createOnce(context);
		return (testCase) => executeWithExistingVisitor(context, visitor, meta, testCase);
	}

	const create = getRuleFunction(rule, "create");
	if (create === undefined) throwHarnessError(`Rule '${ruleName}' does not expose create() or createOnce().`);

	return (testCase) => {
		const context = createMutableContext(ruleName);
		const sourceCode = parseCase(testCase);
		context.sourceCode = sourceCode;
		context.filename = testCase.filename;
		context.physicalFilename = testCase.filename;
		context.options = testCase.options;
		context.settings = testCase.settings;
		context.diagnostics = createDiagnosticCollector(meta);
		const visitor = create(context);
		runVisitor(visitor, sourceCode);
		return { diagnostics: sortDiagnostics(context.diagnostics.diagnostics), sourceCode };
	};
}

function executeWithExistingVisitor(
	context: MutableHarnessContext,
	visitor: unknown,
	meta: Record<string, unknown>,
	testCase: NormalizedCase,
): RuleExecutionResult {
	const sourceCode = parseCase(testCase);
	context.sourceCode = sourceCode;
	context.filename = testCase.filename;
	context.physicalFilename = testCase.filename;
	context.options = testCase.options;
	context.settings = testCase.settings;
	context.diagnostics = createDiagnosticCollector(meta);

	try {
		const shouldRun = runHook(visitor, "before");
		if (shouldRun !== false) runVisitor(visitor, sourceCode);
	} finally {
		runHook(visitor, "after");
	}

	return { diagnostics: sortDiagnostics(context.diagnostics.diagnostics), sourceCode };
}

function sortDiagnostics(diagnostics: ReadonlyArray<RuntimeDiagnostic>): Array<RuntimeDiagnostic> {
	return diagnostics.toSorted(compareDiagnostics);
}

function compareDiagnostics(left: RuntimeDiagnostic, right: RuntimeDiagnostic): number {
	return getDiagnosticStart(left) - getDiagnosticStart(right);
}

function getDiagnosticStart(diagnostic: RuntimeDiagnostic): number {
	return diagnostic.node?.range[0] ?? Number.MAX_SAFE_INTEGER;
}

function createMutableContext(ruleName: string): MutableHarnessContext {
	const unset = createUnsetSourceCode();
	const context: MutableHarnessContext = {
		diagnostics: createDiagnosticCollector({}),
		filename: "",
		id: ruleName,
		options: [],
		physicalFilename: "",
		report(diagnostic): void {
			context.diagnostics.report(diagnostic);
		},
		settings: {},
		sourceCode: unset,
	};
	return context;
}

function createUnsetSourceCode(): HarnessSourceCode {
	return {
		ast: createUnsetNode(),
		comments: [],
		commentsExistBetween: throwUnavailableSourceCode,
		getAllComments: throwUnavailableSourceCode,
		getCommentsAfter: throwUnavailableSourceCode,
		getCommentsBefore: throwUnavailableSourceCode,
		getCommentsInside: throwUnavailableSourceCode,
		getDeclaredVariables: throwUnavailableSourceCode,
		getScope: throwUnavailableSourceCode,
		getText: throwUnavailableSourceCode,
		getTokenAfter: throwUnavailableSourceCode,
		getTokenBefore: throwUnavailableSourceCode,
		isGlobalReference: throwUnavailableSourceCode,
		scopeManager: {
			declaredVariables: new WeakMap(),
			globalScope: {
				block: createUnsetNode(),
				childScopes: [],
				references: [],
				set: new Map(),
				through: [],
				type: "global",
				upper: null,
				variables: [],
			},
			nodeToScope: new WeakMap(),
		},
		text: "",
		tokens: [],
		visitorKeys: {},
	};
}

function throwUnavailableSourceCode(): never {
	throwHarnessError("sourceCode is unavailable before a test case starts.");
}

function createUnsetNode(): HarnessNode {
	return {
		loc: { end: { column: 0, line: 1 }, start: { column: 0, line: 1 } },
		range: [0, 0],
		type: "Program",
	};
}

type RuleFactory = (context: HarnessContext) => unknown;

function getRuleFunction(rule: unknown, key: string): RuleFactory | undefined {
	if (!isRecord(rule)) return undefined;
	const value = getProperty(rule, key);
	return isRuleFactory(value) ? value : undefined;
}

function isRuleFactory(value: unknown): value is RuleFactory {
	return typeof value === "function";
}

function runVisitor(visitor: unknown, sourceCode: HarnessSourceCode): void {
	traverseAst(sourceCode.ast, visitor);
}

function runHook(visitor: unknown, key: string): unknown {
	if (!isRecord(visitor)) return undefined;
	const hook = getProperty(visitor, key);
	if (!isHook(hook)) return undefined;
	return hook();
}

function isHook(value: unknown): value is () => unknown {
	return typeof value === "function";
}
