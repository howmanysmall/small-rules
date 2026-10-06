import { isLogicalExpression } from "@small-rules/oxlint-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import { loadRepositoryUtilities } from "./repository-utilities.ts";
import { findSharedGuard } from "./shared-guard-search.ts";

import type { CreateRule, ESTree, Visitor } from "oxlint-plugin-utilities";

import type { UtilitiesIndex } from "./utilities-index.ts";

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

					const found = findSharedGuard(index, node, getText);
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
