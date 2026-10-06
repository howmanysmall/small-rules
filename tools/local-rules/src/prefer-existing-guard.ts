import { isLogicalExpression } from "@small-rules/oxlint-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import { getEnclosingFunctionName } from "./enclosing-function.ts";
import { matchGuard } from "./guard-matching.ts";
import { loadRepositoryUtilities } from "./repository-utilities.ts";

import type { CreateRule, ESTree, Visitor } from "oxlint-plugin-utilities";

import type { GuardMatch } from "./guard-matching.ts";
import type { SharedGuard, UtilitiesIndex } from "./utilities-index.ts";

interface FoundGuard {
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
function findGuard(index: UtilitiesIndex, node: ESTree.LogicalExpression, getText: GetText): FoundGuard | undefined {
	for (const guard of index.getGuards()) {
		const match = matchGuard(guard, node, getText);
		if (match === undefined) continue;
		return getEnclosingFunctionName(node) === guard.name ? undefined : { guard, match };
	}
	return undefined;
}

export function createPreferExistingGuardRule(getIndex: () => UtilitiesIndex): CreateRule<undefined, "useGuard"> {
	return defineRule({
		create(context): Visitor {
			const index = getIndex();
			const { sourceCode } = context;
			function getText(node: ESTree.Node): string {
				return sourceCode.getText(node);
			}

			return {
				LogicalExpression(node): void {
					// Match whole chains: `a && b && c`, not the `a && b` in it.
					if (isLogicalExpression(node.parent) && node.parent.operator === node.operator) return;

					const found = findGuard(index, node, getText);
					if (found === undefined) return;

					const { guard, match } = found;
					const argumentList = match.arguments.map(getText).join(", ");
					context.report({
						data: {
							guard: guard.name,
							replacement: `${match.negated ? "!" : ""}${guard.name}(${argumentList})`,
							specifier: guard.specifier,
						},
						messageId: "useGuard",
						node,
					});
				},
			} satisfies Visitor;
		},
		meta: {
			docs: {
				description:
					"Prefer an existing shared guard over repeating its body inline, so the check lives in one place",
			},
			messages: {
				useGuard: "Use `{{replacement}}` from `{{specifier}}`; `{{guard}}` already checks this.",
			},
			type: "suggestion",
		},
	});
}

const preferExistingGuard = createPreferExistingGuardRule(loadRepositoryUtilities);

export default preferExistingGuard;
