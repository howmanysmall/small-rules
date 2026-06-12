import { isStringArray } from "$oxc-utilities/type-utilities";
import { type } from "arktype";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const isPairConfiguration = type({
	"alternatives?": type("string[]").readonly().or("undefined"),
	closer: type("string[]").readonly().or("string"),
	opener: "string",
	"openerAlternatives?": type("string[]").readonly().or("undefined"),
	"platform?": type('"roblox" | undefined'),
	"requireSync?": "boolean | undefined",
	"yieldingFunctions?": type("string[]").readonly().or("undefined"),
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

type LoopLikeStatement =
	| ESTree.DoWhileStatement
	| ESTree.ForInStatement
	| ESTree.ForOfStatement
	| ESTree.ForStatement
	| ESTree.WhileStatement;

const LOOP_NODE_TYPES = new Set<string>([
	"DoWhileStatement",
	"ForInStatement",
	"ForOfStatement",
	"ForStatement",
	"WhileStatement",
]);

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
	return branches.filter((branchStack) => branchStack.some((branch) => branch.index === opener.index));
}

function getCallName({ callee }: ESTree.CallExpression): string | undefined {
	if (callee.type === "Identifier") return callee.name;

	if (callee.type === "MemberExpression") {
		const object = callee.object.type === "Identifier" ? callee.object.name : undefined;
		const property = callee.property.type === "Identifier" ? callee.property.name : undefined;
		if (object !== undefined && property !== undefined) return `${object}.${property}`;
	}

	return undefined;
}

function getValidClosers(configuration: PairConfiguration): Array<string> {
	const result = new Array<string>();

	if (isStringArray(configuration.closer)) result.push(...configuration.closer);
	else if (typeof configuration.closer === "string") result.push(configuration.closer);

	if (configuration.alternatives) for (const alternative of configuration.alternatives) result.push(alternative);

	return result;
}

function getAllOpeners(configuration: PairConfiguration): Array<string> {
	const openers = [configuration.opener];
	if (configuration.openerAlternatives) openers.push(...configuration.openerAlternatives);
	return openers;
}

function formatOpenerList(openers: ReadonlyArray<string>): string {
	if (openers.length === 0) return "configured opener";
	if (openers.length === 1) return openers[0] ?? "configured opener";
	return openers.join("' or '");
}

function isLoopLikeStatement(node?: ESTree.Node): node is LoopLikeStatement {
	if (!node) return false;
	return LOOP_NODE_TYPES.has(node.type);
}

function isSwitchStatement(node?: ESTree.Node): node is ESTree.SwitchStatement {
	return node?.type === "SwitchStatement";
}

function findLabeledStatementBody(label: ESTree.Node, startingNode?: ESTree.Node): ESTree.Statement | undefined {
	if (label.type !== "Identifier") return undefined;
	let current: ESTree.Node | undefined = startingNode;

	while (current) {
		if (current.type === "LabeledStatement" && current.label.name === label.name) return current.body;
		current = current.parent ?? undefined;
	}

	return undefined;
}

function resolveBreakTargetLoop(statement: ESTree.BreakStatement): LoopLikeStatement | undefined {
	const labeledBody = statement.label ? findLabeledStatementBody(statement.label, statement.parent) : undefined;

	if (labeledBody) return isLoopLikeStatement(labeledBody) ? labeledBody : undefined;

	let current: ESTree.Node | undefined = statement.parent;
	while (current) {
		if (isLoopLikeStatement(current)) return current;
		if (isSwitchStatement(current)) return undefined;
		current = current.parent ?? undefined;
	}

	return undefined;
}

function resolveContinueTargetLoop(statement: ESTree.ContinueStatement): LoopLikeStatement | undefined {
	const labeledBody = statement.label ? findLabeledStatementBody(statement.label, statement.parent) : undefined;

	if (labeledBody) return isLoopLikeStatement(labeledBody) ? labeledBody : undefined;

	let current: ESTree.Node | undefined = statement.parent;
	while (current) {
		if (isLoopLikeStatement(current)) return current;
		current = current.parent ?? undefined;
	}

	return undefined;
}

function cloneEntry(value: OpenerStackEntry): OpenerStackEntry {
	return { ...value, loopAncestors: [...value.loopAncestors] };
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

const requirePairedCalls = defineRule({
	create(context): Visitor {
		const [rawOptions] = context.options;
		const options: RequirePairedCallsOptions = {
			allowConditionalClosers: rawOptions?.allowConditionalClosers ?? false,
			allowMultipleOpeners: rawOptions?.allowMultipleOpeners ?? true,
			maxNestingDepth: rawOptions?.maxNestingDepth ?? Infinity,
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

		const resolvedOptions: RequirePairedCallsOptions = {
			...(options.allowConditionalClosers === undefined
				? {}
				: { allowConditionalClosers: options.allowConditionalClosers }),
			...(options.allowMultipleOpeners === undefined
				? {}
				: { allowMultipleOpeners: options.allowMultipleOpeners }),
			...(options.maxNestingDepth === undefined ? {} : { maxNestingDepth: options.maxNestingDepth }),
			pairs,
		};

		const openerStack = new Array<OpenerStackEntry>();
		const loopStack = new Array<LoopLikeStatement>();
		let stackIndexCounter = 0;
		const functionStacks = new Array<Array<OpenerStackEntry>>();

		let yieldingAutoClosed = false;
		let yieldingReportedFirst = false;

		const contextStack = new Array<ControlFlowContext>();
		const stackSnapshots = new Map<ESTree.Node, Array<OpenerStackEntry>>();
		const branchStacks = new Map<ESTree.Node, Array<Array<OpenerStackEntry>>>();
		const openerToClosersCache = new Map<string, ReadonlyArray<string>>();

		function getExpectedClosersForOpener(opener: string): ReadonlyArray<string> {
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
			if (!last) return;
			contextStack[contextStack.length - 1] = { ...last, ...updates };
		}

		function cloneStack(): Array<OpenerStackEntry> {
			return openerStack.map(cloneEntry);
		}

		function saveSnapshot(node: ESTree.Node): void {
			stackSnapshots.set(node, cloneStack());
		}

		function findPairConfiguration(functionName: string, isOpener: boolean): PairConfiguration | undefined {
			return resolvedOptions.pairs.find((pair) =>
				(isOpener ? getAllOpeners(pair) : getValidClosers(pair)).includes(functionName),
			);
		}

		function isRobloxYieldingFunction(functionName: string, configuration: PairConfiguration): boolean {
			if (configuration.platform !== "roblox") return false;

			const yieldingFunctions = configuration.yieldingFunctions ?? DEFAULT_ROBLOX_YIELDING_FUNCTIONS;
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
			return validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");
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
			if (
				node.type !== "FunctionDeclaration" &&
				node.type !== "FunctionExpression" &&
				node.type !== "ArrowFunctionExpression"
			) {
				return;
			}

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
				for (const entry of openerStack) {
					reportUnpairedEntry(entry, "function exit");
				}
			}

			const parentStack = functionStacks.pop();
			if (parentStack) {
				openerStack.length = 0;
				openerStack.push(...parentStack);
			} else openerStack.length = 0;

			popContext();
		}

		function onIfStatementEnter(ifNode: ESTree.Node): void {
			if (ifNode.type !== "IfStatement") return;
			pushContext({ inConditional: true });
			saveSnapshot(ifNode);
		}

		function onIfStatementExit(node: ESTree.Node): void {
			if (node.type !== "IfStatement") return;
			popContext();

			const originalStack = stackSnapshots.get(node);
			const branches = branchStacks.get(node);

			if (originalStack && branches && branches.length > 0) {
				const hasCompleteElse = node.alternate !== null;

				for (const branchStack of branches) {
					for (const entry of branchStack) {
						const wasInOriginal = originalStack.some(({ index }) => index === entry.index);
						if (!wasInOriginal) reportUnpairedEntry(entry, "conditional branch");
					}
				}

				if (hasCompleteElse) {
					reportPartiallyClosedOpeners(originalStack, branches, "not all execution paths");

					const commonOpeners = originalStack.filter((opener) => isOpenerInAllBranches(opener, branches));

					openerStack.length = 0;
					openerStack.push(...commonOpeners);
				} else {
					restoreOpenerStack(originalStack);
				}
			}

			stackSnapshots.delete(node);
			branchStacks.delete(node);
		}

		function onIfConsequentExit(node: ESTree.Node): void {
			const consequentNode = node;
			const { parent } = consequentNode;

			if (parent?.type === "IfStatement") {
				const branches = branchStacks.get(parent) ?? [];
				branches.push(cloneStack());
				branchStacks.set(parent, branches);

				const originalStack = stackSnapshots.get(parent);
				if (!originalStack) return;

				openerStack.length = 0;
				for (const entry of originalStack) openerStack.push({ ...entry });
			}
		}

		function onIfAlternateExit(node: ESTree.Node): void {
			const alternateNode = node;
			const { parent } = alternateNode;

			if (parent?.type === "IfStatement") {
				const branches = branchStacks.get(parent) ?? [];
				branches.push(cloneStack());
				branchStacks.set(parent, branches);
			}
		}

		function onTryStatementEnter(node: ESTree.Node): void {
			if (node.type !== "TryStatement") return;
			saveSnapshot(node);
		}

		function onTryStatementExit(node: ESTree.Node): void {
			if (node.type !== "TryStatement") return;
			const originalStack = stackSnapshots.get(node);
			const branches = branchStacks.get(node);

			if (node.finalizer) {
				stackSnapshots.delete(node);
				branchStacks.delete(node);
				return;
			}

			if (originalStack && branches && branches.length > 0) {
				for (const opener of originalStack) {
					const branchesWithOpener = branches.filter((branchStack) =>
						branchStack.some((entry) => entry.index === opener.index),
					);

					if (
						branchesWithOpener.length > 0 &&
						branchesWithOpener.length < branches.length &&
						resolvedOptions.allowConditionalClosers === false
					) {
						const validClosers = getValidClosers(opener.config);
						const closer =
							validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

						context.report({
							data: {
								closer,
								opener: opener.opener,
								paths: "not all execution paths",
							},
							messageId: "unpairedOpener",
							node: opener.node,
						});
					}
				}

				const commonOpeners = originalStack.filter((opener) => isOpenerInAllBranches(opener, branches));

				openerStack.length = 0;
				openerStack.push(...commonOpeners);
			}

			stackSnapshots.delete(node);
			branchStacks.delete(node);
		}

		function onTryBlockEnter(): void {
			pushContext({ inTry: true });
		}

		function onTryBlockExit(node: ESTree.Node): void {
			if (node.type !== "BlockStatement") return;
			const { parent } = node;

			if (parent.type === "TryStatement") {
				const branches = branchStacks.get(parent) ?? [];
				branches.push(cloneStack());
				branchStacks.set(parent, branches);

				const originalStack = stackSnapshots.get(parent);
				if (originalStack) {
					openerStack.length = 0;
					for (const entry of originalStack) openerStack.push({ ...entry });
				}
			}

			popContext();
		}

		function onCatchClauseEnter(): void {
			pushContext({ inCatch: true });
		}

		function onCatchClauseExit(node: ESTree.Node): void {
			if (node.type !== "CatchClause") return;
			const { parent } = node;

			if (parent.type === "TryStatement") {
				const branches = branchStacks.get(parent) ?? [];
				branches.push(cloneStack());
				branchStacks.set(parent, branches);

				const originalStack = stackSnapshots.get(parent);
				if (originalStack) {
					openerStack.length = 0;
					for (const entry of originalStack) openerStack.push({ ...entry });
				}
			}

			popContext();
		}

		function onFinallyBlockEnter(): void {
			pushContext({ inFinally: true });
		}

		function onSwitchStatementEnter(node: ESTree.Node): void {
			if (node.type !== "SwitchStatement") return;
			pushContext({ inConditional: true });
			saveSnapshot(node);
		}

		function onSwitchStatementExit(node: ESTree.Node): void {
			if (node.type !== "SwitchStatement") return;
			popContext();

			const originalStack = stackSnapshots.get(node);
			const branches = branchStacks.get(node);

			if (originalStack && branches && branches.length > 0) {
				const hasDefault = node.cases.some((caseNode) => caseNode.test === null);

				if (hasDefault && branches.length === node.cases.length) {
					reportPartiallyClosedOpeners(originalStack, branches, "not all execution paths");

					const commonOpeners = originalStack.filter((openerEntry) =>
						isOpenerInAllBranches(openerEntry, branches),
					);

					openerStack.length = 0;
					openerStack.push(...commonOpeners);
				} else {
					restoreOpenerStack(originalStack);
				}
			}

			stackSnapshots.delete(node);
			branchStacks.delete(node);
		}

		function onSwitchCaseExit(node: ESTree.Node): void {
			if (node.type !== "SwitchCase") return;
			const { parent } = node;

			if (parent.type === "SwitchStatement") {
				const branches = branchStacks.get(parent) ?? [];
				branches.push(cloneStack());
				branchStacks.set(parent, branches);

				const originalStack = stackSnapshots.get(parent);
				if (!originalStack) return;

				openerStack.length = 0;
				for (const entry of originalStack) openerStack.push({ ...entry });
			}
		}

		function onLoopEnter(node: ESTree.Node): void {
			if (!isLoopLikeStatement(node)) return;
			loopStack.push(node);
			pushContext({ inLoop: true });
		}

		function onLoopExit(): void {
			if (loopStack.length > 0) loopStack.pop();
			popContext();
		}

		function onEarlyExit(statementNode: ESTree.ReturnStatement | ESTree.ThrowStatement): void {
			updateContext({ hasEarlyExit: true });

			const currentContext = getCurrentContext();
			if (currentContext.inFinally || openerStack.length === 0) return;

			for (const { config, node, opener } of openerStack) {
				const validClosers = getValidClosers(config);
				const closer = validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

				const statementType = statementNode.type === "ReturnStatement" ? "return" : "throw";

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

		function onBreakContinue(node: ESTree.Node): void {
			if ((node.type !== "BreakStatement" && node.type !== "ContinueStatement") || openerStack.length === 0) {
				return;
			}

			const targetLoop =
				node.type === "ContinueStatement" ? resolveContinueTargetLoop(node) : resolveBreakTargetLoop(node);

			if (!targetLoop) return;

			for (const { config, loopAncestors, node: openerNode, opener } of openerStack) {
				if (!loopAncestors.some((loopNode) => loopNode === targetLoop)) continue;

				const validClosers = getValidClosers(config);
				const closer = validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

				const statementType = node.type === "BreakStatement" ? "break" : "continue";
				const lineNumber = node.loc.start.line;

				context.report({
					data: {
						closer,
						opener,
						paths: `${statementType} at line ${lineNumber}`,
					},
					messageId: "unpairedOpener",
					node: openerNode,
				});
			}
		}

		function handleOpener(node: ESTree.CallExpression, opener: string, config: PairConfiguration): void {
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
				config,
				index: stackIndexCounter++,
				location: node.loc,
				loopAncestors: [...loopStack],
				node,
				opener,
			};

			openerStack.push(entry);
		}

		function handleCloser(node: ESTree.CallExpression, closer: string): void {
			const matchingIndex = openerStack.findLastIndex((entry) => getValidClosers(entry.config).includes(closer));

			if (matchingIndex === -1) {
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

				return;
			}

			const matchingEntry = openerStack[matchingIndex];
			if (!matchingEntry) return;

			if (matchingIndex !== openerStack.length - 1) {
				const topEntry = openerStack.at(-1);
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

			openerStack.splice(matchingIndex, 1);
		}

		function handleRobloxYield(
			node: ESTree.CallExpression,
			yieldingFunction: string,
			openerEntry: OpenerStackEntry,
		): void {
			const validClosers = getValidClosers(openerEntry.config);
			const closer = validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

			context.report({
				data: { closer, yieldingFunction },
				messageId: "robloxYieldViolation",
				node,
			});
		}

		function onAsyncYield(node: ESTree.Node): void {
			if (node.type !== "AwaitExpression" && node.type !== "YieldExpression" && node.type !== "ForOfStatement") {
				return;
			}
			for (const { config, opener } of openerStack) {
				if (config.requireSync !== true) continue;

				const validClosers = getValidClosers(config);
				const closer = validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

				const asyncType = node.type === "YieldExpression" ? "yield" : "await";

				context.report({
					data: { asyncType, closer, opener },
					messageId: "asyncViolation",
					node,
				});
			}
		}

		function onCallExpression(node: ESTree.Node): void {
			if (node.type !== "CallExpression") return;
			const callName = getCallName(node);
			if (callName === undefined || callName === "") return;

			const openerConfig = findPairConfiguration(callName, true);
			if (openerConfig) {
				handleOpener(node, callName, openerConfig);
				return;
			}

			if (findPairConfiguration(callName, false)) {
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
			"IfStatement > .alternate:exit": onIfAlternateExit,
			"IfStatement > .consequent:exit": onIfConsequentExit,
			"IfStatement:exit": onIfStatementExit,

			ReturnStatement: onEarlyExit,
			"SwitchCase:exit": onSwitchCaseExit,

			SwitchStatement: onSwitchStatementEnter,
			"SwitchStatement:exit": onSwitchStatementExit,
			ThrowStatement: onEarlyExit,
			TryStatement: onTryStatementEnter,
			"TryStatement > .block": onTryBlockEnter,
			"TryStatement > .block:exit": onTryBlockExit,
			"TryStatement > .finalizer": onFinallyBlockEnter,
			"TryStatement > .finalizer:exit": popContext,
			"TryStatement:exit": onTryStatementExit,
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
		fixable: "code",
		messages,
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowConditionalClosers: {
						default: false,
						type: "boolean",
					},
					allowMultipleOpeners: {
						default: true,
						type: "boolean",
					},
					maxNestingDepth: {
						default: 0,
						minimum: 0,
						type: "number",
					},
					pairs: {
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
							required: ["opener", "closer"],
							type: "object",
						},
						minItems: 1,
						type: "array",
					},
				},
				required: ["pairs"],
				type: "object",
			},
		],
		type: "problem",
	},
});

export default requirePairedCalls;
