import { isUseMemoCall } from "$oxc-utilities/oxc-utilities";
import { trackUseMemoImports } from "$oxc-utilities/react-memo-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

export interface UseMemoCallTracker {
	/** Whether a call invokes `useMemo` through a tracked import. */
	readonly isUseMemoCall: (node: ESTree.CallExpression) => boolean;
	/** Visitor that records `useMemo` and React namespace imports. */
	readonly visitor: Visitor;
}

/**
 * Tracks the per-file `useMemo` imports so a rule can recognize its calls.
 *
 * @param reactSources - Module names that count as React.
 * @returns The call predicate and the import visitor that feeds it.
 */
export function createUseMemoCallTracker(reactSources: ReadonlySet<string>): UseMemoCallTracker {
	const memoIdentifiers = new Set<string>();
	const reactNamespaces = new Set<string>();

	return {
		isUseMemoCall: (node) => isUseMemoCall(node, memoIdentifiers, reactNamespaces),
		visitor: {
			ImportDeclaration(node): void {
				trackUseMemoImports(node, reactSources, memoIdentifiers, reactNamespaces);
			},
		},
	};
}
