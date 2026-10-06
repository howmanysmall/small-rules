import { isLogicalExpression } from "@small-rules/oxlint-utilities";

import { getEnclosingFunctionName } from "./enclosing-function.ts";
import { matchGuard } from "./guard-matching.ts";

import type { ESTree } from "oxlint-plugin-utilities";

import type { GuardMatch } from "./guard-matching.ts";
import type { SharedGuard, UtilitiesIndex } from "./utilities-index.ts";

export interface FoundGuard {
	readonly guard: SharedGuard;
	readonly match: GuardMatch;
}

type GetText = (node: ESTree.Node) => string;

/**
 * The first shared guard whose body the chain repeats. A chain inside that
 * guard is the guard itself, so it is left alone.
 *
 * @param index - Shared guards.
 * @param node - Top of a logical chain.
 * @param getText - Source text of a node.
 * @returns The guard and what the chain passes to it.
 */
export function findSharedGuard(
	index: UtilitiesIndex,
	node: ESTree.LogicalExpression,
	getText: GetText,
): FoundGuard | undefined {
	for (const guard of index.getGuards()) {
		const match = matchGuard(guard, node, getText, index.getFunction);
		if (match === undefined) continue;
		return getEnclosingFunctionName(node) === guard.name ? undefined : { guard, match };
	}
	return undefined;
}

/**
 * The top of the logical chain `node` is a term of: `a && b && c` for `b`.
 *
 * @param node - Possible term of a chain.
 * @returns The chain's top, or `undefined` when `node` is not in a chain.
 */
export function getChainTop({ parent }: ESTree.Node): ESTree.LogicalExpression | undefined {
	if (!isLogicalExpression(parent)) return undefined;

	let top = parent;
	while (isLogicalExpression(top.parent) && top.parent.operator === top.operator) top = top.parent;
	return top;
}
