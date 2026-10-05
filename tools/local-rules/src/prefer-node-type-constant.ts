import nodePath from "node:path";
import { defineRule } from "oxlint-plugin-utilities";

import {
	collectArrayNodeTypes,
	collectCaseNodeTypes,
	collectComparedNodeTypes,
	getNodeTypeLiteral,
	getTypeReadObject,
	isEqualityOperator,
} from "./inline-node-types.ts";
import { createNodeTypeCatalog } from "./node-type-catalog.ts";
import { oxlintUtilities } from "./oxlint-utilities-exports.ts";
import { createProjectUsageCounter } from "./project-usage.ts";

import type { CreateRule, ESTree, Visitor } from "oxlint-plugin-utilities";

import type { NodeTypeCatalog } from "./node-type-catalog.ts";
import type { CountUsage } from "./project-usage.ts";

type MessageIds = "addConstant" | "useConstant" | "useGuard";

export interface PreferNodeTypeConstantDependencies {
	readonly catalog: NodeTypeCatalog;
	readonly countUsage: CountUsage;
}

const { isCallbackFunction, isFunctionDeclarationRaw, isIdentifier } = oxlintUtilities;
const WORD_BOUNDARY = /(?<=[a-z\d])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/gv;

function toConstantName(nodeType: string): string {
	return nodeType.replaceAll(WORD_BOUNDARY, "_").toUpperCase();
}

interface GuardSuggestion {
	readonly guard: string;
	readonly guards: ReadonlyArray<string>;
	readonly object: ESTree.Node;
}

function getEnclosingFunctionName(node: ESTree.Node): string | undefined {
	for (let current = node.parent; current !== null; current = current.parent) {
		if (isFunctionDeclarationRaw(current)) return current.id?.name;
		if (isCallbackFunction(current)) return undefined;
	}
	return undefined;
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
	const object = getTypeReadObject(typeSide);
	if (object === undefined) return undefined;

	const nodeType = getComparedNodeType(catalog, valueSide);
	if (nodeType === undefined) return undefined;

	const guards = catalog.getGuards(nodeType);
	const [guard] = guards;
	return guard === undefined ? undefined : { guard, guards, object };
}

export function createPreferNodeTypeConstantRule({
	catalog,
	countUsage,
}: PreferNodeTypeConstantDependencies): CreateRule<undefined, MessageIds> {
	return defineRule({
		create(context): Visitor {
			const { sourceCode } = context;
			const liveCounts = new Map<string, number>();
			const literals = new Array<ESTree.StringLiteral>();
			const replacedByGuard = new Set<ESTree.StringLiteral>();
			const found = new Array<ESTree.StringLiteral>();

			/** Records the inline node types a collector just put in `found`. */
			function record(): void {
				for (const literal of found) {
					literals.push(literal);
					liveCounts.set(literal.value, (liveCounts.get(literal.value) ?? 0) + 1);
				}
			}

			function reportGuard(node: ESTree.BinaryExpression): boolean {
				const { left, right } = node;
				const suggestion = getGuardSuggestion(catalog, left, right) ?? getGuardSuggestion(catalog, right, left);
				if (suggestion === undefined || isInsideGuard(catalog, node)) return false;

				const negation = node.operator.startsWith("!") ? "!" : "";
				context.report({
					data: {
						guards: suggestion.guards.join(", "),
						replacement: `${negation}${suggestion.guard}(${sourceCode.getText(suggestion.object)})`,
					},
					messageId: "useGuard",
					node,
				});
				return true;
			}

			function reportLiteral(literal: ESTree.StringLiteral): void {
				const nodeType = literal.value;
				const constant = catalog.getConstant(nodeType);
				if (constant !== undefined) {
					context.report({ data: { constant, nodeType }, messageId: "useConstant", node: literal });
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
					if (!reportGuard(node)) return;
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
			messages: {
				addConstant:
					'"{{nodeType}}" is inlined {{count}} times in the bundle. Export a shared `{{constant}}` from `@small-rules/oxlint-utilities` and use it instead.',
				useConstant:
					'Use `{{constant}}` from `@small-rules/oxlint-utilities` instead of the inline "{{nodeType}}" string.',
				useGuard:
					"Use `{{replacement}}` from `@small-rules/oxlint-utilities` instead of comparing `.type` (guards: {{guards}}).",
			},
			type: "suggestion",
		},
	});
}

const REPOSITORY_ROOT = nodePath.resolve(import.meta.dirname, "../../..");

const preferNodeTypeConstant = createPreferNodeTypeConstantRule({
	catalog: createNodeTypeCatalog(Object.entries(oxlintUtilities)),
	countUsage: createProjectUsageCounter({
		directories: [
			nodePath.join(REPOSITORY_ROOT, "src"),
			nodePath.join(REPOSITORY_ROOT, "packages/oxlint-utilities/src"),
		],
		maxAgeMilliseconds: 1000,
	}),
});

export default preferNodeTypeConstant;
