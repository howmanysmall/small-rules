// Vendored from src/rules/no-unsafe-dictionary-type.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases. Ancestor suppression checks the same root shapes this rule visits
// (type references, literals, and mapped types) rather than upstream's larger
// type-node kind table; classification outcomes are unchanged.

import {
	classifyUnsafeDictionary,
	classifyUnsafeDictionaryValue,
	createTypeEnvironment,
} from "$oxc-utilities/anti-slop/dictionary-types";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

import type { TypeEnvironment } from "$oxc-utilities/anti-slop/dictionary-types";

function isPlainAliasConsumerUse(type: ESTree.TSType, environment: TypeEnvironment): boolean {
	if (type.type !== "TSTypeReference" || (type.typeArguments?.params.length ?? 0) > 0) return false;
	if (type.typeName.type !== "Identifier") return false;
	if (!environment.aliases.has(type.typeName.name)) return false;
	let current: ESTree.Node | undefined = type.parent;
	while (current !== undefined && current.type !== "Program") {
		if (current.type === "TSTypeAliasDeclaration") return false;
		current = current.parent;
	}
	return true;
}

function shouldReportType(type: ESTree.TSType, environment: TypeEnvironment): boolean {
	if (isPlainAliasConsumerUse(type, environment)) return false;
	const unsafe = classifyUnsafeDictionary(type, environment);
	if (unsafe === undefined) return false;
	let current: ESTree.Node | undefined = type.parent;
	while (current !== undefined && current.type !== "Program") {
		const ancestorClassified =
			current.type === "TSMappedType"
				? classifyUnsafeDictionary(current, environment)
				: current.type === "TSTypeLiteral"
					? classifyUnsafeDictionary(current, environment)
					: current.type === "TSTypeReference"
						? classifyUnsafeDictionary(current, environment)
						: undefined;
		if (ancestorClassified !== undefined) return false;
		current = current.parent;
	}
	return true;
}

const noUnsafeDictionaryType = createRule("no-unsafe-dictionary-type", "anti-slop", {
	createOnce(context): Visitor {
		let environment: TypeEnvironment | undefined;

		function reportIfUnsafe(type: ESTree.TSType): void {
			if (environment === undefined || !shouldReportType(type, environment)) return;
			const unsafe = classifyUnsafeDictionary(type, environment);
			if (unsafe === undefined) return;
			context.report({ data: { value: unsafe.unsafeValue }, messageId: "unsafeDictionary", node: type });
		}

		return {
			Program(node): void {
				environment = createTypeEnvironment(node);
			},
			TSMappedType: reportIfUnsafe,
			TSTypeLiteral: reportIfUnsafe,
			TSTypeReference: reportIfUnsafe,
			TSIndexSignature(node): void {
				if (environment === undefined || node.typeAnnotation === null || node.parent.type === "TSTypeLiteral") {
					return;
				}
				const unsafe = classifyUnsafeDictionaryValue(node.typeAnnotation.typeAnnotation, environment);
				if (unsafe !== undefined) {
					context.report({
						data: { value: unsafe.unsafeValue },
						messageId: "unsafeDictionary",
						node,
					});
				}
			},
		};
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
