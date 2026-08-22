// Vendored from src/rules/no-unsafe-dictionary-type.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local
// path aliases; the type environment starts empty instead of undefined
// because traversal always visits `Program` before any type node.

import {
	classifyUnsafeDictionary,
	classifyUnsafeDictionaryValue,
	createTypeEnvironment,
} from "$oxc-utilities/anti-slop/dictionary-types";
import { createRule } from "$oxc-utilities/create-rule";

import type { TypeEnvironment } from "$oxc-utilities/anti-slop/dictionary-types";
import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

type RuleContext = InferContextFromRule<typeof noUnsafeDictionaryType>;

// Placeholder used only before the `Program` visitor assigns the real
// module-level declarations.
const UNSET_TYPE_ENVIRONMENT: TypeEnvironment = {
	aliases: new Map(),
	interfaces: new Map(),
	shadowedBuiltIns: new Set(),
};

function reportUnsafeDictionary(
	context: RuleContext,
	environment: TypeEnvironment,
	node: ESTree.TSType,
	reportedRanges: Array<readonly [number, number]>,
): void {
	if (reportedRanges.some(([start, end]) => start <= node.start && node.end <= end)) return;
	const unsafe = classifyUnsafeDictionary(node, environment);
	if (unsafe === undefined) return;
	reportedRanges.push(node.range);
	context.report({ data: { value: unsafe }, messageId: "unsafeDictionary", node });
}

const noUnsafeDictionaryType = createRule("no-unsafe-dictionary-type", "anti-slop", {
	createOnce(context): Visitor {
		let environment = UNSET_TYPE_ENVIRONMENT;
		const reportedRanges = new Array<readonly [number, number]>();

		return {
			Program(node): void {
				environment = createTypeEnvironment(node);
				reportedRanges.length = 0;
			},
			TSIndexSignature(node): void {
				const unsafe = classifyUnsafeDictionaryValue(node.typeAnnotation.typeAnnotation, environment);
				if (unsafe === undefined) return;
				if (reportedRanges.some(([start, end]) => start <= node.start && node.end <= end)) return;
				reportedRanges.push(node.range);
				context.report({ data: { value: unsafe }, messageId: "unsafeDictionary", node });
			},
			TSMappedType(node): void {
				reportUnsafeDictionary(context, environment, node, reportedRanges);
			},
			TSTypeLiteral(node): void {
				reportUnsafeDictionary(context, environment, node, reportedRanges);
			},
			TSTypeReference(node): void {
				reportUnsafeDictionary(context, environment, node, reportedRanges);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow object-dictionary contracts whose direct value type is unknown, any, object, {}, or a union/alias containing one of those escape hatches.",
			recommended: true,
		},
		messages: {
			unsafeDictionary:
				"This dictionary's {{value}} value type gives callers no concrete value contract. Use an owner/schema-derived value type; parse external payloads before insertion.",
		},
		type: "problem",
	},
});

export default noUnsafeDictionaryType;
