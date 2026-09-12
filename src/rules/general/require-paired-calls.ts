// oxlint-disable react-doctor/js-set-map-lookups -- out of my control.

import { isBoolean, isReadonlyArrayOfStrings, isString, isUndefined } from "@small-rules/arktype-utilities";
import { type } from "arktype";
import { Predicate } from "effect";

import { createRule } from "$oxc-utilities/create-rule";
import {
	BLOCK_STATEMENT,
	CATCH_CLAUSE,
	isAnyFunction,
	isAwaitExpression,
	isBreakStatement,
	isCallExpression,
	isContinueStatement,
	isForOfStatement,
	isIdentifierName,
	isIfStatement,
	isLabeledStatement,
	isLoopNode,
	isMemberExpression,
	isReturnStatement,
	isSwitchCase,
	isSwitchStatement,
	isTryStatement,
	isYieldExpression,
} from "$oxc-utilities/oxc-utilities";
import { isStringArray } from "$oxc-utilities/type-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";
import type { Writable } from "type-fest";

import type { LoopNode } from "$oxc-utilities/oxc-utilities";

const NOT_ALL = "not all execution paths";
const CLOSER = "closer" as const;

const isPairConfiguration = type({
	"alternatives?": isReadonlyArrayOfStrings.or(isUndefined),
	closer: isReadonlyArrayOfStrings.or(isString),
	opener: isString,
	"openerAlternatives?": isReadonlyArrayOfStrings.or(isUndefined),
	"platform?": '"roblox" | undefined',
	"requireSync?": isBoolean.or(isUndefined),
	"yieldingFunctions?": isReadonlyArrayOfStrings.or(isUndefined),
}).readonly();
type PairConfiguration = typeof isPairConfiguration.infer;

interface RequirePairedCallsOptions {
	readonly allowConditionalClosers?: boolean;
	readonly allowMultipleOpeners?: boolean;
	readonly maxNestingDepth?: number;
	readonly pairs: ReadonlyArray<PairConfiguration>;
}

interface OpenerStackEntry {
	readonly config: PairConfiguration;
	readonly index: number;
	readonly location: unknown;
	readonly loopAncestors: ReadonlyArray<ESTree.Node>;
	readonly node: ESTree.Node;
	readonly opener: string;
}

interface ControlFlowContext {
	readonly asyncContext: boolean;
	readonly currentFunction: ESTree.Node | undefined;
	readonly hasEarlyExit: boolean;
	readonly inCatch: boolean;
	readonly inConditional: boolean;
	readonly inFinally: boolean;
	readonly inLoop: boolean;
	readonly inTry: boolean;
}

const DEFAULT_ROBLOX_YIELDING_FUNCTIONS = ["task.wait", "wait", "*.WaitForChild", "*.*Async"] as const;

function isOpenerInAllBranches(
	opener: OpenerStackEntry,
	branches: ReadonlyArray<ReadonlyArray<OpenerStackEntry>>,
): boolean {
	for (const branchStack of branches) {
		let found = false;
		for (const entry of branchStack) {
			if (entry.index === opener.index) {
				found = true;
				break;
			}
		}
		if (!found) return false;
	}
	return true;
}

function getBranchesWithOpener(
	opener: OpenerStackEntry,
	branches: ReadonlyArray<ReadonlyArray<OpenerStackEntry>>,
): ReadonlyArray<ReadonlyArray<OpenerStackEntry>> {
	return branches.filter((branchStack) => branchStack.some(({ index }) => index === opener.index));
}

function getCallName({ callee }: ESTree.CallExpression): string | undefined {
	if (isIdentifierName(callee)) return callee.name;

	if (isMemberExpression(callee)) {
		const object = isIdentifierName(callee.object) ? callee.object.name : undefined;
		const property = isIdentifierName(callee.property) ? callee.property.name : undefined;
		if (object !== undefined && property !== undefined) return `${object}.${property}`;
	}

	return undefined;
}

function getValidClosers(config: PairConfiguration): Array<string> {
	const result = new Array<string>();
	let size = 0;

	if (isStringArray(config.closer)) {
		for (const closer of config.closer) result[size++] = closer;
	} else {
		/* v8 ignore start -- @preserve validated pair configs only allow string closers after the array branch fails. */
		// oxlint-disable-next-line eslint/no-lonely-if -- V8 ignore must wrap only this defensive validated-shape branch.
		if (Predicate.isString(config.closer)) result[size++] = config.closer;
		/* v8 ignore stop -- @preserve */
	}

	if (config.alternatives) for (const alternative of config.alternatives) result[size++] = alternative;

	return result;
}

function getAllOpeners(config: PairConfiguration): Array<string> {
	const openers = [config.opener];
	if (config.openerAlternatives) {
		let size = 1;
		for (const alternative of config.openerAlternatives) openers[size++] = alternative;
	}
	return openers;
}

function formatOpenerList(openers: ReadonlyArray<string>): string {
	/* v8 ignore next -- @preserve opener labels are only built from configured pairs with required closers. */
	if (openers.length === 0) return "configured opener";
	/* v8 ignore next -- @preserve length-one opener labels come from a concrete configured opener. */
	if (openers.length === 1) return openers[0] ?? "configured opener";
	return openers.join("' or '");
}

function findLabeledStatementBody(label: ESTree.Node, startingNode?: ESTree.Node): ESTree.Statement | undefined {
	/* v8 ignore next -- @preserve ESTree break/continue labels are parser-produced identifiers. */
	if (!isIdentifierName(label)) return undefined;
	let current: ESTree.Node | undefined = startingNode;

	while (current) {
		if (isLabeledStatement(current) && current.label.name === label.name) return current.body;
		/* v8 ignore next -- @preserve parser-produced labeled statements keep parent links during traversal. */
		current = current.parent ?? undefined;
	}

	/* v8 ignore next -- @preserve labeled break/continue traversal either finds a target or syntax required one earlier. */
	return undefined;
}

function resolveTargetLoop(
	statement: ESTree.BreakStatement | ESTree.ContinueStatement,
	allowSwitchTermination: boolean,
): LoopNode | undefined {
	const labeledBody = statement.label ? findLabeledStatementBody(statement.label, statement.parent) : undefined;

	if (labeledBody) return isLoopNode(labeledBody) ? labeledBody : undefined;

	let current: ESTree.Node | undefined = statement.parent;
	while (current) {
		if (isLoopNode(current)) return current;
		if (allowSwitchTermination && isSwitchStatement(current)) return undefined;
		/* v8 ignore next -- @preserve parser-produced break/continue statements keep parent links until a target. */
		current = current.parent ?? undefined;
	}

	/* v8 ignore next -- @preserve valid break/continue syntax supplies an enclosing control-flow target first. */
	return undefined;
}

function resolveBreakTargetLoop(statement: ESTree.BreakStatement): LoopNode | undefined {
	return resolveTargetLoop(statement, true);
}

function resolveContinueTargetLoop(statement: ESTree.ContinueStatement): LoopNode | undefined {
	return resolveTargetLoop(statement, false);
}

function cloneEntry(value: OpenerStackEntry): OpenerStackEntry {
	return { ...value, loopAncestors: [...value.loopAncestors] };
}

function isNewBranchOpener(entry: OpenerStackEntry, originalStack: ReadonlyArray<OpenerStackEntry>): boolean {
	return originalStack.every(({ index }) => index !== entry.index);
}
function isBreakOrContinueStatement(node: ESTree.Node): node is ESTree.BreakStatement | ESTree.ContinueStatement {
	return isBreakStatement(node) || isContinueStatement(node);
}

const messages = {
	asyncViolation: "Cannot use {{asyncType}} between '{{opener}}' and '{{closer}}' (requireSync: true)",
	conditionalOpener: "Conditional opener '{{opener}}' at {{location}} may not have matching closer on all paths",
	maxNestingExceeded: "Maximum nesting depth of {{max}} exceeded for paired calls",
	multipleOpeners:
		"Multiple consecutive calls to '{{opener}}' without matching closers (allowMultipleOpeners: false)",
	robloxYieldViolation:
		"Yielding function '{{yieldingFunction}}' auto-closes all profiles - subsequent '{{closer}}' will error",
	unexpectedCloser: "Unexpected call to '{{closer}}' - expected one of: {{expected}}",
	unpairedCloser: "Unexpected call to '{{closer}}' - no matching opener on stack",
	unpairedOpener: "Unpaired call to '{{opener}}' - missing '{{closer}}' on {{paths}}",
	wrongOrder:
		"Closer '{{closer}}' called out of order - expected to close '{{expected}}' but '{{actual}}' is still open",
} as const;

const requirePairedCalls = createRule("require-paired-calls", "general", {
	create(context): Visitor {
		const [rawOptions] = context.options;
		const options: RequirePairedCallsOptions = {
			allowConditionalClosers: rawOptions?.allowConditionalClosers ?? false,
			allowMultipleOpeners: rawOptions?.allowMultipleOpeners ?? true,
			maxNestingDepth: rawOptions?.maxNestingDepth ?? 0,
			pairs: rawOptions?.pairs ?? [],
		};

		const pairs: ReadonlyArray<PairConfiguration> =
			options.pairs.length === 0
				? [
						{
							closer: "debug.profileend",
							opener: "debug.profilebegin",
							platform: "roblox",
							requireSync: true,
							yieldingFunctions: [...DEFAULT_ROBLOX_YIELDING_FUNCTIONS],
						},
					]
				: options.pairs;

		const resolvedOptions: Writable<RequirePairedCallsOptions> = { pairs };
		/* v8 ignore next -- @preserve options are normalized with concrete boolean defaults before resolution. */
		if (options.allowConditionalClosers !== undefined) {
			resolvedOptions.allowConditionalClosers = options.allowConditionalClosers;
		}
		/* v8 ignore next -- @preserve options are normalized with concrete boolean defaults before resolution. */
		if (options.allowMultipleOpeners !== undefined) {
			resolvedOptions.allowMultipleOpeners = options.allowMultipleOpeners;
		}
		/* v8 ignore next -- @preserve options are normalized with a concrete max depth default before resolution. */
		if (options.maxNestingDepth !== undefined) {
			resolvedOptions.maxNestingDepth = options.maxNestingDepth;
		}

		const openerStack = new Array<OpenerStackEntry>();
		const loopStack = new Array<LoopNode>();
		let stackIndexCounter = 0;
		const functionStacks = new Array<Array<OpenerStackEntry>>();

		let yieldingAutoClosed = false;
		let yieldingReportedFirst = false;

		const contextStack = new Array<ControlFlowContext>();
		const stackSnapshots = new Map<ESTree.Node, Array<OpenerStackEntry>>();
		const branchStacks = new Map<ESTree.Node, Array<Array<OpenerStackEntry>>>();
		const openerToClosersCache = new Map<string, ReadonlyArray<string>>();

		function getExpectedClosersForOpener(opener: string): ReadonlyArray<string> {
			/* v8 ignore next -- @preserve cache hits are written with concrete arrays. */
			if (openerToClosersCache.has(opener)) return openerToClosersCache.get(opener) ?? [];

			const closers = new Array<string>();
			let size = 0;
			for (const pair of resolvedOptions.pairs) {
				const allOpeners = getAllOpeners(pair);
				if (!allOpeners.includes(opener)) continue;

				const validClosers = getValidClosers(pair);
				for (const closer of validClosers) if (!closers.includes(closer)) closers[size++] = closer;
			}

			openerToClosersCache.set(opener, closers);
			return closers;
		}

		function getCurrentContext(): ControlFlowContext {
			return contextStack.length > 0
				? // oxlint-disable-next-line typescript/no-non-null-assertion -- previous check handled.
					contextStack.at(-1)!
				: {
						asyncContext: false,
						currentFunction: undefined,
						hasEarlyExit: false,
						inCatch: false,
						inConditional: false,
						inFinally: false,
						inLoop: false,
						inTry: false,
					};
		}

		function pushContext(newContext: Partial<ControlFlowContext>): void {
			const currentContext = getCurrentContext();
			contextStack.push({ ...currentContext, ...newContext });
		}

		function popContext(): void {
			contextStack.pop();
		}

		function updateContext(updates: Partial<ControlFlowContext>): void {
			const last = contextStack.at(-1);
			/* v8 ignore next -- @preserve context updates are only issued while a visitor context is active. */
			if (!last) return;
			contextStack[contextStack.length - 1] = { ...last, ...updates };
		}

		function cloneStack(): Array<OpenerStackEntry> {
			return openerStack.map(cloneEntry);
		}

		function saveSnapshot(node: ESTree.Node): void {
			stackSnapshots.set(node, cloneStack());
		}

		function findPairConfig(functionName: string, isOpener: boolean): PairConfiguration | undefined {
			return resolvedOptions.pairs.find((pair) =>
				(isOpener ? getAllOpeners(pair) : getValidClosers(pair)).includes(functionName),
			);
		}

		function isRobloxYieldingFunction(functionName: string, config: PairConfiguration): boolean {
			if (config.platform !== "roblox") return false;

			const yieldingFunctions = config.yieldingFunctions ?? DEFAULT_ROBLOX_YIELDING_FUNCTIONS;
			return yieldingFunctions.some((pattern) => {
				if (pattern.startsWith("*.")) {
					const methodName = pattern.slice(2);
					return functionName.endsWith(`.${methodName}`);
				}
				return functionName === pattern;
			});
		}

		function getCloserLabel(config: PairConfiguration): string {
			const validClosers = getValidClosers(config);
			/* v8 ignore next -- @preserve configured pairs always provide at least one closer label. */
			return validClosers.length === 1 ? (validClosers[0] ?? CLOSER) : validClosers.join("' or '");
		}

		function reportUnpairedEntry(entry: OpenerStackEntry, paths: string): void {
			context.report({
				data: {
					closer: getCloserLabel(entry.config),
					opener: entry.opener,
					paths,
				},
				messageId: "unpairedOpener",
				node: entry.node,
			});
		}

		function restoreOpenerStack(entries: ReadonlyArray<OpenerStackEntry>): void {
			openerStack.length = 0;
			for (const entry of entries) openerStack.push({ ...entry });
		}

		function recordBranchSnapshot(node: ESTree.Node): void {
			const branches = branchStacks.get(node) ?? [];
			branches.push(cloneStack());
			branchStacks.set(node, branches);
		}

		function reportPartiallyClosedOpeners(
			openers: ReadonlyArray<OpenerStackEntry>,
			branches: ReadonlyArray<ReadonlyArray<OpenerStackEntry>>,
			paths: string,
		): void {
			for (const opener of openers) {
				const branchesWithOpener = getBranchesWithOpener(opener, branches);
				if (branchesWithOpener.length <= 0 || branchesWithOpener.length >= branches.length) continue;
				if (resolvedOptions.allowConditionalClosers !== false) continue;
				reportUnpairedEntry(opener, paths);
			}
		}

		function onFunctionEnter(node: ESTree.Node): void {
			/* v8 ignore if -- @preserve this handler is only registered for function-like visitor keys. */
			if (!isAnyFunction(node)) return;

			functionStacks.push([...openerStack]);
			openerStack.length = 0;

			yieldingAutoClosed = false;
			yieldingReportedFirst = false;

			pushContext({
				asyncContext: node.async,
				currentFunction: node,
				hasEarlyExit: false,
				inCatch: false,
				inConditional: false,
				inFinally: false,
				inLoop: false,
				inTry: false,
			});
		}

		function onFunctionExit(): void {
			if (openerStack.length > 0) {
				for (const entry of openerStack) reportUnpairedEntry(entry, "function exit");
			}

			const parentStack = functionStacks.pop();
			/* v8 ignore else -- @preserve function exits are paired with function enters that push a parent stack. */
			if (parentStack) {
				openerStack.length = 0;
				for (const entry of parentStack) openerStack.push(entry);
			} else openerStack.length = 0;

			popContext();
		}

		function onIfStatementEnter(ifNode: ESTree.Node): void {
			/* v8 ignore next -- @preserve this handler is only registered for IfStatement visitor keys. */
			if (!isIfStatement(ifNode)) return;
			pushContext({ inConditional: true });
			saveSnapshot(ifNode);
		}

		function reportNewOpenersInBranches(
			originalStack: Array<OpenerStackEntry>,
			branches: Array<Array<OpenerStackEntry>>,
		): void {
			for (const branchStack of branches) {
				for (const entry of branchStack) {
					if (isNewBranchOpener(entry, originalStack)) reportUnpairedEntry(entry, "conditional branch");
				}
			}
		}

		function retainOpenersInAllBranches(
			originalStack: Array<OpenerStackEntry>,
			branches: Array<Array<OpenerStackEntry>>,
		): void {
			openerStack.length = 0;
			for (const opener of originalStack) {
				if (!isOpenerInAllBranches(opener, branches)) continue;
				openerStack.push(opener);
			}
		}

		function retainCommonOpeners(
			originalStack: Array<OpenerStackEntry>,
			branches: Array<Array<OpenerStackEntry>>,
		): void {
			reportPartiallyClosedOpeners(originalStack, branches, NOT_ALL);
			retainOpenersInAllBranches(originalStack, branches);
		}

		function mergeIfBranches(
			node: ESTree.IfStatement,
			originalStack: Array<OpenerStackEntry>,
			branches: Array<Array<OpenerStackEntry>>,
		): void {
			reportNewOpenersInBranches(originalStack, branches);
			if (node.alternate === null) restoreOpenerStack(originalStack);
			else retainCommonOpeners(originalStack, branches);
		}

		function onIfStatementExit(node: ESTree.Node): void {
			/* v8 ignore next -- @preserve this handler is only registered for IfStatement visitor keys. */
			if (!isIfStatement(node)) return;
			popContext();

			const originalStack = stackSnapshots.get(node);
			const branches = branchStacks.get(node);

			/* v8 ignore else -- @preserve if exits are paired with enter snapshots and branch snapshots. */
			if (originalStack && branches && branches.length > 0) {
				mergeIfBranches(node, originalStack, branches);
			}

			stackSnapshots.delete(node);
			branchStacks.delete(node);
		}

		function onIfConsequentExit({ parent }: ESTree.Node): void {
			/* v8 ignore next -- @preserve consequent exit selector only runs for IfStatement consequents. */
			if (!isIfStatement(parent)) return;
			recordBranchSnapshot(parent);

			const originalStack = stackSnapshots.get(parent);
			/* v8 ignore next -- @preserve consequent exits are paired with IfStatement enter snapshots. */
			if (!originalStack) return;
			restoreOpenerStack(originalStack);
		}

		function onIfAlternateExit({ parent }: ESTree.Node): void {
			/* v8 ignore else -- @preserve alternate exit selector only runs for IfStatement alternates. */
			if (isIfStatement(parent)) recordBranchSnapshot(parent);
		}

		function onTryStatementEnter(node: ESTree.Node): void {
			/* v8 ignore next -- @preserve this handler is only registered for TryStatement visitor keys. */
			if (!isTryStatement(node)) return;
			saveSnapshot(node);
		}

		function isPartiallyClosedTryOpener(
			opener: OpenerStackEntry,
			branches: Array<Array<OpenerStackEntry>>,
		): boolean {
			const branchesWithOpener = getBranchesWithOpener(opener, branches);
			if (branchesWithOpener.length === 0 || branchesWithOpener.length >= branches.length) return false;
			return resolvedOptions.allowConditionalClosers === false;
		}

		function reportTryPartialOpener(opener: OpenerStackEntry): void {
			const validClosers = getValidClosers(opener.config);
			/* v8 ignore next -- @preserve configured pairs always provide at least one closer label. */
			const closer = validClosers.length === 1 ? (validClosers[0] ?? CLOSER) : validClosers.join("' or '");

			context.report({
				data: {
					closer,
					opener: opener.opener,
					paths: NOT_ALL,
				},
				messageId: "unpairedOpener",
				node: opener.node,
			});
		}

		function reportPartiallyClosedTryOpeners(
			originalStack: Array<OpenerStackEntry>,
			branches: Array<Array<OpenerStackEntry>>,
		): void {
			for (const opener of originalStack) {
				if (isPartiallyClosedTryOpener(opener, branches)) reportTryPartialOpener(opener);
			}
		}

		function mergeTryBranches(
			originalStack: Array<OpenerStackEntry>,
			branches: Array<Array<OpenerStackEntry>>,
		): void {
			reportPartiallyClosedTryOpeners(originalStack, branches);
			retainOpenersInAllBranches(originalStack, branches);
		}

		function onTryStatementExit(node: ESTree.Node): void {
			/* v8 ignore next -- @preserve this handler is only registered for TryStatement visitor keys. */
			if (!isTryStatement(node)) return;
			const originalStack = stackSnapshots.get(node);
			const branches = branchStacks.get(node);

			if (node.finalizer) {
				stackSnapshots.delete(node);
				branchStacks.delete(node);
				return;
			}

			/* v8 ignore else -- @preserve try exits with recorded branches are paired with enter snapshots. */
			if (originalStack && branches && branches.length > 0) mergeTryBranches(originalStack, branches);

			stackSnapshots.delete(node);
			branchStacks.delete(node);
		}

		function onTryBlockEnter(): void {
			pushContext({ inTry: true });
		}

		function onTryBranchExit(node: ESTree.Node, nodeType: "BlockStatement" | "CatchClause"): void {
			/* v8 ignore next -- @preserve try branch exit wrappers pass the matching ESTree node kind. */
			if (node.type !== nodeType) return;
			const { parent } = node;

			/* v8 ignore else -- @preserve try branch exit selectors only run for TryStatement children. */
			if (isTryStatement(parent)) {
				recordBranchSnapshot(parent);

				const originalStack = stackSnapshots.get(parent);
				/* v8 ignore next -- @preserve try branch exits are paired with TryStatement enter snapshots. */
				if (originalStack) restoreOpenerStack(originalStack);
			}

			popContext();
		}

		function onTryBlockExit(node: ESTree.Node): void {
			onTryBranchExit(node, BLOCK_STATEMENT);
		}

		function onCatchClauseEnter(): void {
			pushContext({ inCatch: true });
		}

		function onCatchClauseExit(node: ESTree.Node): void {
			onTryBranchExit(node, CATCH_CLAUSE);
		}

		function onFinallyBlockEnter(): void {
			pushContext({ inFinally: true });
		}

		function onSwitchStatementEnter(node: ESTree.Node): void {
			/* v8 ignore next -- @preserve this handler is only registered for SwitchStatement visitor keys. */
			if (!isSwitchStatement(node)) return;
			pushContext({ inConditional: true });
			saveSnapshot(node);
		}

		function onSwitchStatementExit(node: ESTree.Node): void {
			/* v8 ignore next -- @preserve this handler is only registered for SwitchStatement visitor keys. */
			if (!isSwitchStatement(node)) return;
			popContext();

			const originalStack = stackSnapshots.get(node);
			const branches = branchStacks.get(node);

			/* v8 ignore else -- @preserve switch exits with recorded cases are paired with enter snapshots. */
			if (originalStack && branches && branches.length > 0) {
				const hasDefault = node.cases.some((caseNode) => caseNode.test === null);

				if (hasDefault && branches.length === node.cases.length) {
					reportPartiallyClosedOpeners(originalStack, branches, NOT_ALL);

					const commonOpeners = originalStack.filter((openerEntry) =>
						isOpenerInAllBranches(openerEntry, branches),
					);

					openerStack.length = 0;
					for (const entry of commonOpeners) openerStack.push(entry);
				} else restoreOpenerStack(originalStack);
			}

			stackSnapshots.delete(node);
			branchStacks.delete(node);
		}

		function onSwitchCaseExit(node: ESTree.Node): void {
			/* v8 ignore next -- @preserve this handler is only registered for SwitchCase visitor keys. */
			if (!isSwitchCase(node)) return;
			const { parent } = node;

			/* v8 ignore else -- @preserve switch case exit selector only runs for SwitchStatement cases. */
			if (isSwitchStatement(parent)) {
				recordBranchSnapshot(parent);

				const originalStack = stackSnapshots.get(parent);
				/* v8 ignore next -- @preserve switch case exits are paired with SwitchStatement enter snapshots. */
				if (!originalStack) return;

				restoreOpenerStack(originalStack);
			}
		}

		function onLoopEnter(node: ESTree.Node): void {
			/* v8 ignore next -- @preserve this handler is only registered for loop-like visitor keys. */
			if (!isLoopNode(node)) return;
			loopStack.push(node);
			pushContext({ inLoop: true });
		}

		function onLoopExit(): void {
			/* v8 ignore else -- @preserve loop exits are paired with loop enters that push the loop stack. */
			if (loopStack.length > 0) loopStack.pop();
			popContext();
		}

		function onEarlyExit(statementNode: ESTree.ReturnStatement | ESTree.ThrowStatement): void {
			updateContext({ hasEarlyExit: true });

			const currentContext = getCurrentContext();
			if (currentContext.inFinally || openerStack.length === 0) return;

			for (const { config, node, opener } of openerStack) {
				const validClosers = getValidClosers(config);
				/* v8 ignore next -- @preserve configured pairs always provide at least one closer label. */
				const closer = validClosers.length === 1 ? (validClosers[0] ?? CLOSER) : validClosers.join("' or '");

				const statementType = isReturnStatement(statementNode) ? "return" : "throw";

				context.report({
					data: {
						closer,
						opener,
						paths: `${statementType} at line ${statementNode.loc.start.line}`,
					},
					messageId: "unpairedOpener",
					node,
				});
			}
		}

		function resolveBreakContinueTarget(
			node: ESTree.BreakStatement | ESTree.ContinueStatement,
		): LoopNode | undefined {
			if (isContinueStatement(node)) return resolveContinueTargetLoop(node);
			return resolveBreakTargetLoop(node);
		}

		function reportBreakContinueEntry(
			entry: OpenerStackEntry,
			statement: ESTree.BreakStatement | ESTree.ContinueStatement,
			targetLoop: LoopNode,
		): void {
			if (entry.loopAncestors.every((loopNode) => loopNode !== targetLoop)) return;

			const validClosers = getValidClosers(entry.config);
			/* v8 ignore next -- @preserve configured pairs always provide at least one closer label. */
			const closer = validClosers.length === 1 ? (validClosers[0] ?? CLOSER) : validClosers.join("' or '");

			const statementType = isBreakStatement(statement) ? "break" : "continue";

			context.report({
				data: {
					closer,
					opener: entry.opener,
					paths: `${statementType} at line ${statement.loc.start.line}`,
				},
				messageId: "unpairedOpener",
				node: entry.node,
			});
		}

		function onBreakContinue(node: ESTree.Node): void {
			if (openerStack.length === 0 || !isBreakOrContinueStatement(node)) return;

			const targetLoop = resolveBreakContinueTarget(node);
			if (targetLoop === undefined) return;

			for (const entry of openerStack) reportBreakContinueEntry(entry, node, targetLoop);
		}

		function handleOpener(node: ESTree.CallExpression, opener: string, pairConfiguration: PairConfiguration): void {
			/* v8 ignore next -- @preserve options are normalized with a concrete max depth default before opener handling. */
			const maxDepth = resolvedOptions.maxNestingDepth ?? 0;
			if (maxDepth > 0 && openerStack.length >= maxDepth) {
				context.report({
					data: { max: String(maxDepth) },
					messageId: "maxNestingExceeded",
					node,
				});
			}

			if (
				resolvedOptions.allowMultipleOpeners === false &&
				openerStack.length > 0 &&
				openerStack.at(-1)?.opener === opener
			) {
				context.report({
					data: { opener },
					messageId: "multipleOpeners",
					node,
				});
			}

			const entry: OpenerStackEntry = {
				config: pairConfiguration,
				index: stackIndexCounter++,
				location: node.loc,
				loopAncestors: [...loopStack],
				node,
				opener,
			};

			openerStack.push(entry);
		}

		function reportUnmatchedCloser(node: ESTree.CallExpression, closer: string): void {
			if (yieldingAutoClosed && !yieldingReportedFirst) {
				yieldingReportedFirst = true;
				return;
			}

			if (openerStack.length === 0) {
				context.report({
					data: { closer },
					messageId: "unpairedCloser",
					node,
				});
				return;
			}

			// oxlint-disable-next-line typescript/no-non-null-assertion -- openerStack length was checked above.
			const topEntry = openerStack.at(-1)!;
			const expectedClosers = getExpectedClosersForOpener(topEntry.opener);
			const closerDescription = formatOpenerList(expectedClosers);

			context.report({
				data: {
					closer,
					expected: closerDescription,
				},
				messageId: "unexpectedCloser",
				node,
			});
		}

		function reportWrongOrderCloser(
			node: ESTree.CallExpression,
			closer: string,
			matchingEntry: OpenerStackEntry,
			matchingIndex: number,
		): void {
			if (matchingIndex === openerStack.length - 1) return;
			const topEntry = openerStack.at(-1);
			/* v8 ignore else -- @preserve a non-last matching index implies a top stack entry exists. */
			if (topEntry) {
				context.report({
					data: {
						actual: topEntry.opener,
						closer,
						expected: matchingEntry.opener,
					},
					messageId: "wrongOrder",
					node,
				});
			}
		}

		function handleCloser(node: ESTree.CallExpression, closer: string): void {
			const matchingIndex = openerStack.findLastIndex((entry) => getValidClosers(entry.config).includes(closer));

			if (matchingIndex === -1) {
				reportUnmatchedCloser(node, closer);
				return;
			}

			const matchingEntry = openerStack[matchingIndex];
			/* v8 ignore next -- @preserve findLastIndex returned a valid index into openerStack. */
			if (!matchingEntry) return;

			reportWrongOrderCloser(node, closer, matchingEntry, matchingIndex);
			openerStack.splice(matchingIndex, 1);
		}

		function handleRobloxYield(
			node: ESTree.CallExpression,
			yieldingFunction: string,
			openerEntry: OpenerStackEntry,
		): void {
			const validClosers = getValidClosers(openerEntry.config);
			/* v8 ignore next -- @preserve configured pairs always provide at least one closer label. */
			const closer = validClosers.length === 1 ? (validClosers[0] ?? CLOSER) : validClosers.join("' or '");

			context.report({
				data: { closer, yieldingFunction },
				messageId: "robloxYieldViolation",
				node,
			});
		}

		function onAsyncYield(node: ESTree.Node): void {
			/* v8 ignore if -- @preserve this handler is only registered for await/yield/for-of visitor keys. */
			if (!isAwaitExpression(node) && !isYieldExpression(node) && !isForOfStatement(node)) return;
			for (const { config, opener } of openerStack) {
				if (config.requireSync !== true) continue;

				const validClosers = getValidClosers(config);
				/* v8 ignore next -- @preserve configured pairs always provide at least one closer label. */
				const closer = validClosers.length === 1 ? (validClosers[0] ?? CLOSER) : validClosers.join("' or '");

				const asyncType = isYieldExpression(node) ? "yield" : "await";

				context.report({
					data: { asyncType, closer, opener },
					messageId: "asyncViolation",
					node,
				});
			}
		}

		function onCallExpression(node: ESTree.Node): void {
			/* v8 ignore next -- @preserve this handler is only registered for CallExpression visitor keys. */
			if (!isCallExpression(node)) return;
			const callName = getCallName(node);
			if (callName === undefined || callName === "") return;

			const openerConfig = findPairConfig(callName, true);
			if (openerConfig) {
				handleOpener(node, callName, openerConfig);
				return;
			}

			if (findPairConfig(callName, false)) {
				handleCloser(node, callName);
				return;
			}

			for (const entry of openerStack) {
				if (!isRobloxYieldingFunction(callName, entry.config)) continue;

				handleRobloxYield(node, callName, entry);
				openerStack.length = 0;
				yieldingAutoClosed = true;
				return;
			}
		}

		return {
			ArrowFunctionExpression: onFunctionEnter,
			"ArrowFunctionExpression:exit": onFunctionExit,
			AwaitExpression: onAsyncYield,
			BreakStatement: onBreakContinue,

			CallExpression: onCallExpression,
			CatchClause: onCatchClauseEnter,
			"CatchClause:exit": onCatchClauseExit,
			ContinueStatement: onBreakContinue,
			DoWhileStatement: onLoopEnter,
			"DoWhileStatement:exit": onLoopExit,
			ForInStatement: onLoopEnter,
			"ForInStatement:exit": onLoopExit,
			ForOfStatement: (node): void => {
				if (node.await) onAsyncYield(node);
				onLoopEnter(node);
			},
			"ForOfStatement:exit": onLoopExit,

			ForStatement: onLoopEnter,
			"ForStatement:exit": onLoopExit,
			FunctionDeclaration: onFunctionEnter,
			"FunctionDeclaration:exit": onFunctionExit,
			FunctionExpression: onFunctionEnter,
			"FunctionExpression:exit": onFunctionExit,

			IfStatement: onIfStatementEnter,
			"IfStatement:exit": onIfStatementExit,
			"IfStatement > .alternate:exit": onIfAlternateExit,
			"IfStatement > .consequent:exit": onIfConsequentExit,

			ReturnStatement: onEarlyExit,
			"SwitchCase:exit": onSwitchCaseExit,

			SwitchStatement: onSwitchStatementEnter,
			"SwitchStatement:exit": onSwitchStatementExit,
			ThrowStatement: onEarlyExit,
			TryStatement: onTryStatementEnter,
			"TryStatement:exit": onTryStatementExit,
			"TryStatement > .block": onTryBlockEnter,
			"TryStatement > .block:exit": onTryBlockExit,
			"TryStatement > .finalizer": onFinallyBlockEnter,
			"TryStatement > .finalizer:exit": popContext,
			WhileStatement: onLoopEnter,
			"WhileStatement:exit": onLoopExit,
			YieldExpression: onAsyncYield,
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Enforces balanced opener/closer function calls across all execution paths",
			recommended: false,
		},
		messages,
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowConditionalClosers: {
						default: false,
						description: "Allow closer calls that appear only on some conditional paths.",
						type: "boolean",
					},
					allowMultipleOpeners: {
						default: true,
						description: "Allow repeated opener calls before matching closer calls.",
						type: "boolean",
					},
					maxNestingDepth: {
						default: 0,
						description: "Maximum opener nesting depth before reporting; 0 disables the limit.",
						minimum: 0,
						type: "number",
					},
					pairs: {
						default: [
							{
								closer: "debug.profileend",
								opener: "debug.profilebegin",
								platform: "roblox",
								requireSync: true,
								yieldingFunctions: [...DEFAULT_ROBLOX_YIELDING_FUNCTIONS],
							},
						],
						description: "Opener and closer call pairs that must stay balanced.",
						items: {
							additionalProperties: false,
							properties: {
								alternatives: {
									items: { minLength: 1, type: "string" },
									type: "array",
								},
								closer: {
									oneOf: [
										{ minLength: 1, type: "string" },
										{
											items: { minLength: 1, type: "string" },
											minItems: 1,
											type: "array",
										},
									],
								},
								opener: {
									minLength: 1,
									type: "string",
								},
								openerAlternatives: {
									items: { minLength: 1, type: "string" },
									type: "array",
								},
								platform: {
									enum: ["roblox"],
									type: "string",
								},
								requireSync: {
									default: false,
									type: "boolean",
								},
								yieldingFunctions: {
									items: { minLength: 1, type: "string" },
									type: "array",
								},
							},
							required: ["opener", CLOSER],
							type: "object",
						},
						minItems: 1,
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default requirePairedCalls;
