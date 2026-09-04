// Vendored from src/rules/no-unsafe-dictionary-type.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path
// aliases. Ancestor suppression checks the same root shapes this rule visits
// (type references, literals, and mapped types) rather than upstream's larger
// type-node kind table. Type-parameter constraints are excluded iteratively.

import {
	classifyUnsafeDictionary,
	classifyUnsafeDictionaryValue,
	createTypeEnvironment,
} from "$oxc-utilities/anti-slop/dictionary-types";
import { visibleTypeAlias } from "$oxc-utilities/anti-slop/type-alias-resolution";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isBindingIdentifier,
	isProgram,
	isTsMappedType,
	isTsTypeAliasDeclaration,
	isTsTypeLiteral,
	isTsTypeParameter,
	isTsTypeReference,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

import type { TypeEnvironment, UnsafeDictionary } from "$oxc-utilities/anti-slop/dictionary-types";

function isPlainAliasConsumerUse(type: ESTree.TSType, environment: TypeEnvironment): boolean {
	if (!isTsTypeReference(type) || (type.typeArguments?.params.length ?? 0) > 0) return false;
	if (
		!isBindingIdentifier(type.typeName) ||
		visibleTypeAlias(type.typeName.name, type, environment.typeAliases) === undefined
	) {
		return false;
	}

	let { parent } = type;
	while (!isProgram(parent)) {
		if (isTsTypeAliasDeclaration(parent)) return false;
		({ parent } = parent);
	}
	return true;
}

function isInsideTypeParameterConstraint(node: ESTree.TSType): boolean {
	let child: ESTree.Node = node;
	let { parent } = child;
	while (!isProgram(parent)) {
		if (isTsTypeParameter(parent) && parent.constraint === child) return true;
		child = parent;
		({ parent } = child);
	}
	return false;
}

function reportableUnsafeDictionary(type: ESTree.TSType, environment: TypeEnvironment): undefined | UnsafeDictionary {
	if (isInsideTypeParameterConstraint(type)) return undefined;
	if (isPlainAliasConsumerUse(type, environment)) return undefined;

	const unsafe = classifyUnsafeDictionary(type, environment);
	if (unsafe === undefined) return undefined;

	let { parent } = type;
	while (!isProgram(parent)) {
		let ancestorClassified: undefined | UnsafeDictionary;
		if (isTsMappedType(parent) || isTsTypeLiteral(parent) || isTsTypeReference(parent)) {
			ancestorClassified = classifyUnsafeDictionary(parent, environment);
		}
		if (ancestorClassified !== undefined) return undefined;
		({ parent } = parent);
	}
	return unsafe;
}

const noUnsafeDictionaryType = createRule("no-unsafe-dictionary-type", "anti-slop", {
	createOnce(context): Visitor {
		let environment: TypeEnvironment | undefined;

		function reportIfUnsafe(type: ESTree.TSType): void {
			/* v8 ignore next -- Program visitors initialize rule state before child visitors run. @preserve */
			if (environment === undefined) return;

			const unsafe = reportableUnsafeDictionary(type, environment);
			if (unsafe === undefined) return;

			context.report({ data: { value: unsafe.unsafeValue }, messageId: "unsafeDictionary", node: type });
		}

		return {
			Program(node): void {
				environment = createTypeEnvironment(node, context.sourceCode.visitorKeys);
			},
			TSIndexSignature(node): void {
				/* v8 ignore next -- Program visitors initialize rule state before child visitors run. @preserve */
				if (environment === undefined || isTsTypeLiteral(node.parent)) return;
				const unsafe = classifyUnsafeDictionaryValue(node.typeAnnotation.typeAnnotation, environment);
				if (unsafe !== undefined) {
					context.report({
						data: { value: unsafe.unsafeValue },
						messageId: "unsafeDictionary",
						node,
					});
				}
			},
			TSMappedType: reportIfUnsafe,
			TSTypeLiteral: reportIfUnsafe,
			TSTypeReference: reportIfUnsafe,
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
