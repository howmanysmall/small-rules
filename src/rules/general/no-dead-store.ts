import { forEachScopeVariable } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isAnyFunction,
	isAnyLiteral,
	isArrayExpression,
	isArrowFunctionExpression,
	isAssignmentExpression,
	isAssignmentPattern,
	isBindingIdentifier,
	isBlockStatement,
	isBreakStatement,
	isConditionalExpression,
	isContinueStatement,
	isFunctionDeclaration,
	isFunctionExpression,
	isIfStatement,
	isLogicalExpression,
	isLoopNode,
	isObjectExpression,
	isObjectPattern,
	isProgram,
	isRestElement,
	isReturnStatement,
	isSwitchCase,
	isSwitchStatement,
	isThrowStatement,
	isTryStatement,
	isUnaryExpression,
	isUpdateExpression,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Reference, Variable, Visitor } from "oxlint-plugin-utilities";

interface BranchStep {
	readonly arm: string;
	readonly complete: boolean;
	readonly control: ESTree.Node;
}

interface VariableUsage {
	readonly init: boolean;
	readonly isRead: boolean;
	readonly isWrite: boolean;
	readonly node: Reference["identifier"];
	readonly writeExpression: ESTree.Expression | undefined;
}

function statementTransfersControl(node: ESTree.Node): boolean {
	let current = node;
	while (isBlockStatement(current)) {
		/* v8 ignore next -- @preserve callers only inspect non-empty consequent blocks. */
		const last = current.body.at(-1);
		/* v8 ignore next -- @preserve non-empty consequent blocks always have a final statement. */
		if (last === undefined) return false;
		current = last;
	}
	return (
		isBreakStatement(current) ||
		isContinueStatement(current) ||
		isReturnStatement(current) ||
		isThrowStatement(current)
	);
}

function executionRoot(node: ESTree.Node): ESTree.Node {
	let current = node;
	while (current.parent !== null) {
		if (isAnyFunction(current)) return current;
		current = current.parent;
	}
	return current;
}

function conditionalBranchStep(current: ESTree.Node, parent: ESTree.Node): BranchStep | undefined {
	if (isIfStatement(parent)) {
		if (parent.consequent === current) {
			return {
				arm: "then",
				complete: parent.alternate !== null || statementTransfersControl(parent.consequent),
				control: parent,
			};
		}
		if (parent.alternate === current) return { arm: "else", complete: true, control: parent };
	} else if (isConditionalExpression(parent)) {
		if (parent.consequent === current) return { arm: "then", complete: true, control: parent };
		if (parent.alternate === current) return { arm: "else", complete: true, control: parent };
	}
	return undefined;
}

function implicitElseSteps(current: ESTree.Node, parent: ESTree.Node): ReadonlyArray<BranchStep> {
	const blockStatement = isBlockStatement(parent);
	if (!blockStatement && !isSwitchCase(parent)) return [];

	const siblings: ReadonlyArray<ESTree.Node> = blockStatement ? parent.body : parent.consequent;
	const index = siblings.indexOf(current);
	if (index <= 0) return [];

	const steps = new Array<BranchStep>();
	for (const sibling of siblings.slice(0, index)) {
		if (isIfStatement(sibling) && sibling.alternate === null && statementTransfersControl(sibling.consequent)) {
			steps.push({ arm: "else", complete: true, control: sibling });
		}
	}
	return steps;
}

function branchStep(current: ESTree.Node, parent: ESTree.Node): BranchStep | undefined {
	const conditionalStep = conditionalBranchStep(current, parent);
	if (conditionalStep !== undefined) return conditionalStep;
	if (isLogicalExpression(parent) && parent.right === current) {
		return { arm: "right", complete: false, control: parent };
	}
	if (isLoopNode(parent) && parent.body === current) return { arm: "body", complete: false, control: parent };

	if (isSwitchCase(current) && isSwitchStatement(parent)) {
		return { arm: `case:${current.range[0]}`, complete: false, control: parent };
	}

	if (isTryStatement(parent)) {
		if (parent.block === current) return { arm: "try", complete: false, control: parent };
		if (parent.handler === current) return { arm: "catch", complete: false, control: parent };
	}
	return undefined;
}

function branchPath(node: ESTree.Node, root: ESTree.Node): ReadonlyArray<BranchStep> {
	const path = new Array<BranchStep>();
	let current = node;
	while (current !== root && current.parent !== null) {
		const step = branchStep(current, current.parent);
		if (step !== undefined) path.push(step);
		for (const elseStep of implicitElseSteps(current, current.parent)) path.push(elseStep);
		current = current.parent;
	}
	return path;
}

function branchArm(path: ReadonlyArray<BranchStep>, control: ESTree.Node): string | undefined {
	return path.find((step) => step.control === control)?.arm;
}

function pathsAreCompatible(left: ReadonlyArray<BranchStep>, right: ReadonlyArray<BranchStep>): boolean {
	for (const step of left) {
		const rightArm = branchArm(right, step.control);
		if (rightArm !== undefined && rightArm !== step.arm) return false;
	}
	return true;
}

function assignmentReadsPreviousValue(write: VariableUsage, usages: ReadonlyArray<VariableUsage>): boolean {
	const { parent } = write.node;
	if (!isAssignmentExpression(parent)) return false;
	// Compound assignments (+=, -=, etc.) always read the previous value of the
	// left-hand side, even when the right-hand side doesn't reference the
	// variable.
	if (parent.operator !== "=") return true;
	return usages.some((usage) => usage.isRead && rangeContains(parent.right, usage.node));
}

function mergePaths(
	left: ReadonlyArray<BranchStep>,
	right: ReadonlyArray<BranchStep>,
): ReadonlyArray<BranchStep> | undefined {
	if (right.length !== left.length) return undefined;
	let differingControl: ESTree.Node | undefined;
	for (const step of left) {
		if (branchArm(right, step.control) === step.arm) continue;
		if (differingControl !== undefined) return undefined;
		differingControl = step.control;
	}
	if (differingControl === undefined || branchArm(right, differingControl) === undefined) return undefined;
	return left.filter((step) => step.control !== differingControl);
}

interface MergeablePair {
	readonly leftIndex: number;
	readonly merged: ReadonlyArray<BranchStep>;
	readonly rightIndex: number;
}

function findFirstMergeablePair(coveredPaths: Array<ReadonlyArray<BranchStep>>): MergeablePair | undefined {
	for (const [leftIndex, left] of coveredPaths.entries()) {
		for (const [rightIndex, right] of coveredPaths.entries()) {
			if (rightIndex <= leftIndex) continue;

			const merged = mergePaths(left, right);
			if (merged === undefined) continue;
			return { leftIndex, merged, rightIndex };
		}
	}
	return undefined;
}

function mergeCoveredPaths(coveredPaths: Array<ReadonlyArray<BranchStep>>): boolean {
	const pair = findFirstMergeablePair(coveredPaths);
	if (pair === undefined) return false;

	coveredPaths[pair.leftIndex] = pair.merged;
	coveredPaths.splice(pair.rightIndex, 1);
	return pair.merged.length === 0 || mergeCoveredPaths(coveredPaths);
}

function isGuaranteedOverwrite(
	writePath: ReadonlyArray<BranchStep>,
	currentPath: ReadonlyArray<BranchStep>,
	coveredPaths: Array<ReadonlyArray<BranchStep>>,
): boolean {
	const extraSteps = writePath.filter((step) => branchArm(currentPath, step.control) === undefined);
	if (extraSteps.length === 0) return true;
	if (extraSteps.some((step) => !step.complete)) return false;

	function currentArm(step: BranchStep): string | undefined {
		return branchArm(currentPath, step.control);
	}

	/* v8 ignore next -- @preserve unreachable: extra steps are filtered to controls absent from the current path. */
	if (
		extraSteps.some((step) => {
			const arm = currentArm(step);
			/* v8 ignore next -- @preserve extra steps cannot reference controls in the current path, so the arm check cannot hold. */
			return arm !== undefined && arm !== step.arm;
		})
	) {
		/* v8 ignore next -- @preserve unreachable: the arm check above can never hold for filtered extra steps. */
		return false;
	}

	coveredPaths.push(extraSteps);
	return mergeCoveredPaths(coveredPaths);
}

function usageObservesPreviousValue(usage: VariableUsage, usages: ReadonlyArray<VariableUsage>): boolean {
	return (usage.isRead && !usage.isWrite) || (usage.isWrite && assignmentReadsPreviousValue(usage, usages));
}

function collectLoopAncestors(node: ESTree.Node): ReadonlyArray<ESTree.Node> {
	const loops = new Array<ESTree.Node>();
	let current: ESTree.Node | null = node.parent;
	while (current !== null) {
		if (isLoopNode(current)) loops.push(current);
		else if (
			isProgram(current) ||
			isArrowFunctionExpression(current) ||
			isFunctionDeclaration(current) ||
			isFunctionExpression(current)
		) {
			break;
		}
		current = current.parent;
	}
	return loops;
}

function hasCommonLoopAncestor(write: VariableUsage, usage: VariableUsage): boolean {
	const writeLoops = collectLoopAncestors(write.node);
	let current: ESTree.Node | null = usage.node.parent;
	// oxlint-disable-next-line typescript/no-unnecessary-condition -- giga coal
	while (current !== null) {
		for (const loop of writeLoops) if (loop === current) return true;
		if (
			isProgram(current) ||
			isArrowFunctionExpression(current) ||
			isFunctionDeclaration(current) ||
			isFunctionExpression(current)
		) {
			break;
		}
		current = current.parent;
	}
	return false;
}

function isReadAcrossLoop(usage: VariableUsage, write: VariableUsage, root: ESTree.Node): boolean {
	return usage.isRead && !usage.isWrite && executionRoot(usage.node) === root && hasCommonLoopAncestor(write, usage);
}

function checkObservation(
	usage: VariableUsage,
	write: VariableUsage,
	root: ESTree.Node,
	currentPath: ReadonlyArray<BranchStep>,
	coveredPaths: Array<ReadonlyArray<BranchStep>>,
	usages: ReadonlyArray<VariableUsage>,
): boolean | undefined {
	if (usage.node.range[0] <= write.node.range[0]) {
		if (usage.node.range[0] < write.node.range[0] && isReadAcrossLoop(usage, write, root)) return true;
		return undefined;
	}
	if (executionRoot(usage.node) !== root) return undefined;

	const referencePath = branchPath(usage.node, root);
	if (pathsAreCompatible(currentPath, referencePath)) {
		if (usageObservesPreviousValue(usage, usages)) return true;
		if (usage.isWrite && isGuaranteedOverwrite(referencePath, currentPath, coveredPaths)) return false;
		return undefined;
	}

	return isReadAcrossLoop(usage, write, root) ? true : undefined;
}

function valueIsObserved(write: VariableUsage, usages: ReadonlyArray<VariableUsage>): boolean {
	const root = executionRoot(write.node);
	const currentPath = branchPath(write.node, root);
	const coveredPaths = new Array<ReadonlyArray<BranchStep>>();

	for (const usage of usages) {
		const result = checkObservation(usage, write, root, currentPath, coveredPaths, usages);
		if (result === true) return true;
		if (result === false) return false;
	}
	return false;
}

function isBasicInitializer(node: ESTree.Expression): boolean {
	if (isAnyLiteral(node)) {
		return (
			node.value === null ||
			node.value === false ||
			node.value === true ||
			node.value === "" ||
			node.value === -1 ||
			node.value === 0 ||
			node.value === 1
		);
	}
	if (isBindingIdentifier(node)) return node.name === "undefined";
	if (isArrayExpression(node)) return node.elements.length === 0;
	if (isObjectExpression(node)) return node.properties.length === 0;
	if (isUnaryExpression(node)) return node.operator === "void" || isBasicInitializer(node.argument);
	return false;
}

function destructuringHasRest(node: ESTree.Node): boolean {
	let current = node;
	while (current.parent !== null && !isVariableDeclarator(current.parent)) {
		if (isObjectPattern(current.parent) && current.parent.properties.some(isRestElement)) return true;
		current = current.parent;
	}
	return false;
}

function rangeContains(container: ESTree.Node, node: ESTree.Node): boolean {
	return container.range[0] <= node.range[0] && container.range[1] >= node.range[1];
}

function isTryWriteReadByHandler(usage: VariableUsage, variable: Variable): boolean {
	let current: ESTree.Node = usage.node;
	while (current.parent !== null) {
		const parent: ESTree.Node = current.parent;
		if (isTryStatement(parent) && parent.block === current) {
			const handlers = [parent.handler?.body, parent.finalizer].filter(
				(node): node is ESTree.BlockStatement => node !== null && node !== undefined,
			);
			if (
				handlers.some((handler) =>
					variable.references.some(
						(candidate) => candidate.isRead() && rangeContains(handler, candidate.identifier),
					),
				)
			) {
				return true;
			}
		}
		current = parent;
	}
	return false;
}

function shouldCheck(usage: VariableUsage, variable: Variable): boolean {
	if (!usage.isWrite || isProgram(variable.scope.block) || variable.name.startsWith("_")) return false;

	const { parent } = usage.node;
	if (
		isAssignmentPattern(parent) ||
		isUpdateExpression(parent) ||
		(isAssignmentExpression(parent) && isAnyLiteral(parent.right) && parent.right.value === null) ||
		destructuringHasRest(usage.node) ||
		(usage.init && usage.writeExpression !== undefined && isBasicInitializer(usage.writeExpression))
	) {
		return false;
	}

	return !isTryWriteReadByHandler(usage, variable);
}

function isCaptured(variable: Variable): boolean {
	const roots = new Set(variable.references.map((reference) => executionRoot(reference.identifier)));
	for (const definition of variable.defs) roots.add(executionRoot(definition.name));
	return variable.references.some((reference) => reference.isRead()) && roots.size > 1;
}

function getVariableUsages(variable: Variable): Array<VariableUsage> {
	const usages: Array<VariableUsage> = variable.references.map((reference) => ({
		init: reference.init,
		isRead: reference.isRead(),
		isWrite: reference.isWrite(),
		node: reference.identifier,
		writeExpression: reference.writeExpr ?? undefined,
	}));
	for (const definition of variable.defs) {
		if (
			definition.type !== "Variable" ||
			!isVariableDeclarator(definition.node) ||
			definition.node.init === null ||
			usages.some((usage) => usage.node.range[0] === definition.name.range[0])
		) {
			continue;
		}
		usages.push({
			init: true,
			isRead: false,
			isWrite: true,
			node: definition.name,
			writeExpression: definition.node.init,
		});
	}
	return usages.toSorted((left, right) => left.node.range[0] - right.node.range[0]);
}

const noDeadStore = createRule("no-dead-store", "general", {
	create(context): Visitor {
		return {
			Program(): void {
				forEachScopeVariable(context.sourceCode, (variable): void => {
					if (isCaptured(variable)) return;

					const usages = getVariableUsages(variable);
					for (const usage of usages) {
						if (!shouldCheck(usage, variable) || valueIsObserved(usage, usages)) continue;
						context.report({
							data: { name: variable.name },
							messageId: "deadStore",
							node: usage.node,
						});
					}
				});
			},
		};
	},
	meta: {
		docs: {
			description: "Disallow assignments whose value is never read.",
		},
		messages: { deadStore: 'The value assigned to "{{name}}" is never read.' },
		schema: [],
		type: "problem",
	},
});

export default noDeadStore;
