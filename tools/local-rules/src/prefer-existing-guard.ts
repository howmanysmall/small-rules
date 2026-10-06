import {
	isAnyLiteral,
	isIdentifier,
	isLogicalExpression,
	isMemberExpression,
	isThisExpression,
} from "@small-rules/oxlint-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import { createImportingFix, noFix } from "./import-fixes.ts";
import { loadRepositoryUtilities } from "./repository-utilities.ts";
import { findSharedGuards } from "./shared-guard-search.ts";

import type { CreateRule, ESTree, Visitor } from "oxlint-plugin-utilities";

import type { FoundGuard } from "./shared-guard-search.ts";
import type { UtilitiesIndex } from "./utilities-index.ts";

/**
 * An argument whose evaluation cannot change anything: a name, `this`, a
 * literal, or a property path on one of those.
 *
 * @param node - Argument the chain passes.
 * @returns Whether evaluating it once instead of several times is the same.
 */
function isSideEffectFree(node: ESTree.Node): boolean {
	let current = node;
	while (isMemberExpression(current)) {
		if (current.computed && !isAnyLiteral(current.property)) return false;
		current = current.object;
	}
	return isIdentifier(current) || isThisExpression(current) || isAnyLiteral(current);
}

export function createPreferExistingGuardRule(
	getIndex: () => UtilitiesIndex,
): CreateRule<undefined, "useGuard" | "useGuardSuggestion"> {
	return defineRule({
		create(context): Visitor {
			const index = getIndex();
			const ownSpecifier = index.getSpecifierOf(context.filename);
			const { sourceCode } = context;
			function getText(node: ESTree.Node): string {
				return sourceCode.getText(node);
			}

			/**
			 * Reports the terms a guard replaces. They may evaluate an argument
			 * several times and the guard only once, so a call among the
			 * arguments turns the fix into a suggestion.
			 *
			 * @param node - Top of the chain.
			 * @param found - The guard, what the terms pass to it, and their source.
			 */
			function reportGuard(node: ESTree.LogicalExpression, { guard, match, range }: FoundGuard): void {
				const argumentList = match.arguments.map(getText).join(", ");
				const replacement = `${match.negated ? "!" : ""}${guard.name}(${argumentList})`;
				const isDefiningModule = ownSpecifier === guard.specifier;
				const fix = createImportingFix(sourceCode, node, replacement, guard, isDefiningModule, range);
				const isSafe = match.arguments.every(isSideEffectFree);
				context.report({
					data: { guard: guard.name, replacement, specifier: guard.specifier },
					fix: isSafe ? fix : noFix,
					messageId: "useGuard",
					node,
					suggest: isSafe ? [] : [{ data: { replacement }, fix, messageId: "useGuardSuggestion" }],
				});
			}

			return {
				LogicalExpression(node): void {
					// Search each chain once, from its top.
					if (isLogicalExpression(node.parent) && node.parent.operator === node.operator) return;
					for (const found of findSharedGuards(index, node, sourceCode)) reportGuard(node, found);
				},
			} satisfies Visitor;
		},
		meta: {
			docs: {
				description:
					"Prefer an existing shared guard over repeating its body inline, so the check lives in one place",
			},
			fixable: "code",
			hasSuggestions: true,
			messages: {
				useGuard: "Use `{{replacement}}` from `{{specifier}}`; `{{guard}}` already checks this.",
				useGuardSuggestion: "Use `{{replacement}}`.",
			},
			type: "suggestion",
		},
	});
}

const preferExistingGuard = createPreferExistingGuardRule(loadRepositoryUtilities);

export default preferExistingGuard;
