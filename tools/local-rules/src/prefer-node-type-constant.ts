import nodePath from "node:path";
import { defineRule } from "oxlint-plugin-utilities";

import { getEnclosingFunctionName } from "./enclosing-function.ts";
import { createImportingFix, noFix } from "./import-fixes.ts";
import {
	collectArrayNodeTypes,
	collectCaseNodeTypes,
	collectComparedNodeTypes,
	getNodeTypeLiteral,
	getTypeReadMember,
	isEqualityOperator,
} from "./inline-node-types.ts";
import { createNodeTypeCatalog } from "./node-type-catalog.ts";
import { oxlintUtilities } from "./oxlint-utilities-exports.ts";
import { createProjectUsageCounter } from "./project-usage.ts";
import { loadRepositoryUtilities, REPOSITORY_ROOT } from "./repository-utilities.ts";
import { findSharedGuard, getChainTop } from "./shared-guard-search.ts";

import type { CreateRule, ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { ImportingFix } from "./import-fixes.ts";
import type { NodeTypeCatalog } from "./node-type-catalog.ts";
import type { CountUsage } from "./project-usage.ts";
import type { UtilitiesIndex } from "./utilities-index.ts";

type MessageIds = "addConstant" | "useConstant" | "useGuard" | "useGuardSuggestion";

export interface PreferNodeTypeConstantDependencies {
	readonly catalog: NodeTypeCatalog;
	readonly countUsage: CountUsage;
	/** Shared guards: chains they cover go to `prefer-existing-guard`. */
	readonly getUtilities: () => UtilitiesIndex;
}

const { isChainExpression, isIdentifier } = oxlintUtilities;
const WORD_BOUNDARY = /(?<=[a-z\d])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/gv;
const TRAILING_ACCESS = /\??\.$/v;

function toConstantName(nodeType: string): string {
	return nodeType.replaceAll(WORD_BOUNDARY, "_").toUpperCase();
}

interface GuardSuggestion {
	readonly guard: string;
	readonly guards: ReadonlyArray<string>;
	readonly member: ESTree.MemberExpression;
	/** Whether the code reads `node?.type`, which is safe on a missing node. */
	readonly optional: boolean;
}

interface GuardFixPlan {
	/** The guard to apply automatically, when exactly one fits. */
	readonly fixGuard: string | undefined;
	/** Guards to offer instead, when several narrow differently. */
	readonly suggestedGuards: ReadonlyArray<string>;
}

const UTILITIES_SPECIFIER = "@small-rules/oxlint-utilities";

/**
 * The source of the object a `.type` access reads, with any parentheses it
 * has, so `(first, second).type` stays one argument.
 *
 * @param sourceCode - The file.
 * @param member - The `.type` access.
 * @returns Everything before `.type` or `?.type`.
 */
function getReadObjectText(sourceCode: SourceCode, member: ESTree.MemberExpression): string {
	const text = sourceCode.text.slice(member.range[0], member.property.range[0]).trimEnd();
	return text.replace(TRAILING_ACCESS, "").trimEnd();
}

/**
 * `node?.type` is safe on a missing node, so a guard only replaces it when the
 * guard is too. Several guards narrow to different types, so only a single one
 * is applied automatically.
 *
 * @param catalog - Known guards.
 * @param suggestion - Guards for the comparison.
 * @returns What to fix automatically and what to suggest.
 */
function planGuardFix(catalog: NodeTypeCatalog, { guards, optional }: GuardSuggestion): GuardFixPlan {
	const usable = guards.filter((guard) => !optional || catalog.isNullSafe(guard));
	if (guards.length > 1) {
		return { fixGuard: undefined, suggestedGuards: usable };
	}

	const [fixGuard] = usable;
	return { fixGuard, suggestedGuards: [] };
}

/**
 * The comparison inside a guard is the guard itself.
 *
 * @param catalog - Known guards.
 * @param node - Comparison to place.
 * @returns Whether `node` sits directly in a guard's body.
 */
function isInsideGuard(catalog: NodeTypeCatalog, node: ESTree.Node): boolean {
	const functionName = getEnclosingFunctionName(node);
	return functionName !== undefined && catalog.isGuardName(functionName);
}

function getComparedNodeType(catalog: NodeTypeCatalog, node: ESTree.Node): string | undefined {
	if (isIdentifier(node)) return catalog.getNodeTypeOfConstant(node.name);
	return getNodeTypeLiteral(node)?.value;
}

/**
 * A guard replaces `node.type === X` when one exists for X.
 *
 * @param catalog - Known guards and constants.
 * @param typeSide - Operand that may read `.type`.
 * @param valueSide - Operand that may hold the node type.
 * @returns The guards for the compared node type, if any.
 */
function getGuardSuggestion(
	catalog: NodeTypeCatalog,
	typeSide: ESTree.Node,
	valueSide: ESTree.Node,
): GuardSuggestion | undefined {
	const member = getTypeReadMember(typeSide);
	if (member === undefined) return undefined;

	const nodeType = getComparedNodeType(catalog, valueSide);
	if (nodeType === undefined) return undefined;

	const guards = catalog.getGuards(nodeType);
	const [guard] = guards;
	return guard === undefined ? undefined : { guard, guards, member, optional: isChainExpression(typeSide) };
}

export function createPreferNodeTypeConstantRule({
	catalog,
	countUsage,
	getUtilities,
}: PreferNodeTypeConstantDependencies): CreateRule<undefined, MessageIds> {
	return defineRule({
		create(context): Visitor {
			const { sourceCode } = context;
			const liveCounts = new Map<string, number>();
			const literals = new Array<ESTree.StringLiteral>();
			const replacedByGuard = new Set<ESTree.StringLiteral>();
			const found = new Array<ESTree.StringLiteral>();
			const utilities = getUtilities();

			function getText(node: ESTree.Node): string {
				return sourceCode.getText(node);
			}

			function isCoveredBySharedGuard(node: ESTree.BinaryExpression): boolean {
				const top = getChainTop(node);
				return top !== undefined && findSharedGuard(utilities, top, getText) !== undefined;
			}

			/** Records the inline node types a collector just put in `found`. */
			function record(): void {
				for (const literal of found) {
					literals.push(literal);
					liveCounts.set(literal.value, (liveCounts.get(literal.value) ?? 0) + 1);
				}
			}

			function createUtilitiesFix(node: ESTree.Node, replacement: string, name: string): ImportingFix {
				return createImportingFix(
					sourceCode,
					node,
					replacement,
					{ name, specifier: UTILITIES_SPECIFIER },
					false,
				);
			}

			function reportGuard(node: ESTree.BinaryExpression): boolean {
				const { left, right } = node;
				const suggestion = getGuardSuggestion(catalog, left, right) ?? getGuardSuggestion(catalog, right, left);
				if (suggestion === undefined || isInsideGuard(catalog, node)) return false;

				const negation = node.operator.startsWith("!") ? "!" : "";
				const objectText = getReadObjectText(sourceCode, suggestion.member);
				function replaceWith(guard: string): string {
					return `${negation}${guard}(${objectText})`;
				}

				const { fixGuard, suggestedGuards } = planGuardFix(catalog, suggestion);
				context.report({
					data: { guards: suggestion.guards.join(", "), replacement: replaceWith(suggestion.guard) },
					fix: fixGuard === undefined ? noFix : createUtilitiesFix(node, replaceWith(fixGuard), fixGuard),
					messageId: "useGuard",
					node,
					suggest: suggestedGuards.map((guard) => ({
						data: { replacement: replaceWith(guard) },
						fix: createUtilitiesFix(node, replaceWith(guard), guard),
						messageId: "useGuardSuggestion",
					})),
				});
				return true;
			}

			function reportLiteral(literal: ESTree.StringLiteral): void {
				const nodeType = literal.value;
				const constant = catalog.getConstant(nodeType);
				if (constant !== undefined) {
					context.report({
						data: { constant, nodeType },
						fix: createUtilitiesFix(literal, constant, constant),
						messageId: "useConstant",
						node: literal,
					});
					return;
				}

				// One inline copy is smaller than a constant plus its import.
				const count = countUsage(nodeType, context.filename, liveCounts);
				if (count < 2) return;

				context.report({
					data: { constant: toConstantName(nodeType), count: String(count), nodeType },
					messageId: "addConstant",
					node: literal,
				});
			}

			return {
				ArrayExpression(node): void {
					found.length = 0;
					collectArrayNodeTypes(node, found);
					record();
				},
				BinaryExpression(node): void {
					if (!isEqualityOperator(node.operator)) return;

					found.length = 0;
					collectComparedNodeTypes(node, found);
					record();
					if (!isCoveredBySharedGuard(node) && !reportGuard(node)) return;
					for (const literal of found) replacedByGuard.add(literal);
				},
				"Program:exit"(): void {
					for (const literal of literals) if (!replacedByGuard.has(literal)) reportLiteral(literal);
				},
				SwitchStatement(node): void {
					found.length = 0;
					collectCaseNodeTypes(node, found);
					record();
				},
			} satisfies Visitor;
		},
		meta: {
			docs: {
				description:
					"Prefer the type guards and node type constants in `@small-rules/oxlint-utilities` over inline node type strings, so the bundle stores each string once",
			},
			fixable: "code",
			hasSuggestions: true,
			messages: {
				addConstant:
					'"{{nodeType}}" is inlined {{count}} times in the bundle. Export a shared `{{constant}}` from `@small-rules/oxlint-utilities` and use it instead.',
				useConstant:
					'Use `{{constant}}` from `@small-rules/oxlint-utilities` instead of the inline "{{nodeType}}" string.',
				useGuard:
					"Use `{{replacement}}` from `@small-rules/oxlint-utilities` instead of comparing `.type` (guards: {{guards}}).",
				useGuardSuggestion: "Use `{{replacement}}`.",
			},
			type: "suggestion",
		},
	});
}

const preferNodeTypeConstant = createPreferNodeTypeConstantRule({
	catalog: createNodeTypeCatalog(Object.entries(oxlintUtilities)),
	countUsage: createProjectUsageCounter({
		directories: [
			nodePath.join(REPOSITORY_ROOT, "src"),
			nodePath.join(REPOSITORY_ROOT, "packages/oxlint-utilities/src"),
		],
		maxAgeMilliseconds: 1000,
	}),
	getUtilities: loadRepositoryUtilities,
});

export default preferNodeTypeConstant;
