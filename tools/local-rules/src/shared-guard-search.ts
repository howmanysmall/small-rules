import { isLogicalExpression } from "@small-rules/oxlint-utilities";

import { getEnclosingFunctionName } from "./enclosing-function.ts";
import { flattenChain, getGuardTerms, matchGuard } from "./guard-matching.ts";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

import type { GuardMatch, GuardMatchContext } from "./guard-matching.ts";
import type { SharedGuard, UtilitiesIndex } from "./utilities-index.ts";

export interface FoundGuard {
	readonly guard: SharedGuard;
	readonly match: GuardMatch;
	/** The source range of the terms the guard replaces. */
	readonly range: readonly [number, number];
}

interface ChainSearch {
	readonly context: GuardMatchContext;
	readonly index: UtilitiesIndex;
	readonly sourceText: string;
	readonly terms: ReadonlyArray<ESTree.Expression>;
	readonly top: ESTree.LogicalExpression;
}

/**
 * Whether the terms sit next to each other with only the chain's operator
 * between them, so their source can be replaced as one piece without leaving
 * a parenthesis or comment behind.
 *
 * @param window - Consecutive terms of the chain.
 * @param search - The chain being searched.
 * @returns Whether the terms' source is one contiguous stretch.
 */
function isContiguous(window: ReadonlyArray<ESTree.Expression>, { sourceText, top }: ChainSearch): boolean {
	return window.every((term, index) => {
		const next = window.at(index + 1);
		return next === undefined || sourceText.slice(term.range[1], next.range[0]).trim() === top.operator;
	});
}

function getWindowRange(window: ReadonlyArray<ESTree.Expression>, search: ChainSearch): readonly [number, number] {
	// The whole chain is the top node, whose range keeps any parentheses
	// balanced.
	if (window.length === search.terms.length) return search.top.range;
	let start = Number.POSITIVE_INFINITY;
	let end = Number.NEGATIVE_INFINITY;
	for (const { range } of window) {
		start = Math.min(start, range[0]);
		end = Math.max(end, range[1]);
	}
	return [start, end];
}

function findGuardAt(search: ChainSearch, start: number): FoundGuard | undefined {
	const { context, index, terms, top } = search;
	for (const guard of index.getGuards()) {
		const window = terms.slice(start, start + getGuardTerms(guard).length);
		if (window.length !== getGuardTerms(guard).length) continue;
		if (window.length !== terms.length && !isContiguous(window, search)) continue;

		const match = matchGuard(guard, window, top.operator, context);
		// The chain inside a guard is the guard itself.
		if (match === undefined || getEnclosingFunctionName(top) === guard.name) continue;
		return { guard, match, range: getWindowRange(window, search) };
	}
	return undefined;
}

/**
 * Every run of consecutive terms in a chain that repeats a shared guard's
 * body, left to right without overlap.
 *
 * @param index - Shared guards and constants.
 * @param top - Top of a logical chain.
 * @param sourceCode - The file.
 * @returns The guards found and the source each one replaces.
 */
export function findSharedGuards(
	index: UtilitiesIndex,
	top: ESTree.LogicalExpression,
	sourceCode: SourceCode,
): ReadonlyArray<FoundGuard> {
	const terms = new Array<ESTree.Expression>();
	flattenChain(top, top.operator, terms);
	const context: GuardMatchContext = {
		getConstantValue: index.getConstantValue,
		getFunction: index.getFunction,
		getText: (node) => sourceCode.getText(node),
	};
	const search: ChainSearch = { context, index, sourceText: sourceCode.text, terms, top };

	const found = new Array<FoundGuard>();
	let start = 0;
	while (start < terms.length) {
		const guard = findGuardAt(search, start);
		if (guard === undefined) {
			start += 1;
			continue;
		}
		found.push(guard);
		start += getGuardTerms(guard.guard).length;
	}
	return found;
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
