import {
	CHAIN_EXPRESSION,
	PARENTHESIZED_EXPRESSION,
	TS_AS_EXPRESSION,
	TS_INSTANTIATION_EXPRESSION,
	TS_NON_NULL_EXPRESSION,
	TS_SATISFIES_EXPRESSION,
	TS_TYPE_ASSERTION,
} from "@small-rules/oxlint-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

/** Node types that wrap an expression without changing its value. */
export const EXPRESSION_WRAPPER_TYPES: ReadonlySet<string> = new Set([
	CHAIN_EXPRESSION,
	PARENTHESIZED_EXPRESSION,
	TS_AS_EXPRESSION,
	TS_INSTANTIATION_EXPRESSION,
	TS_NON_NULL_EXPRESSION,
	TS_SATISFIES_EXPRESSION,
	TS_TYPE_ASSERTION,
]);

/**
 * Climbs from `node` past any expression wrappers (parentheses, `as`,
 * `satisfies`, non-null assertions, and similar).
 *
 * @param node - The node to start from.
 * @returns The first ancestor-or-self that is not a wrapper.
 */
export function ascendPastExpressionWrappers(node?: ESTree.Node): ESTree.Node | undefined {
	let current = node;
	/* v8 ignore next -- @preserve wrapper parents are optional parser shapes; parser-produced wrappers always have parents. */
	while (current !== undefined && EXPRESSION_WRAPPER_TYPES.has(current.type)) current = current.parent ?? undefined;
	return current;
}
