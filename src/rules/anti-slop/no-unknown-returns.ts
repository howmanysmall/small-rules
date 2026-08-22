// Vendored from src/rules/no-unknown-returns.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: local API and path alias adaptation.

import { lexicalTypeParameterNames } from "$oxc-utilities/anti-slop/lexical-type-parameters";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

type FunctionWithReturnType =
	| ESTree.ArrowFunctionExpression
	| ESTree.Function
	| ESTree.TSCallSignatureDeclaration
	| ESTree.TSConstructorType
	| ESTree.TSConstructSignatureDeclaration
	| ESTree.TSFunctionType
	| ESTree.TSMethodSignature;

function enqueueContainedTypes(type: ESTree.TSType, nextTypes: Array<ESTree.TSType>): boolean {
	switch (type.type) {
		case "TSParenthesizedType": {
			nextTypes.push(type.typeAnnotation);
			return true;
		}

		case "TSUnionType": {
			for (const member of type.types) nextTypes.push(member);
			return true;
		}

		default: {
			return false;
		}
	}
}

function enqueueTypeReference(
	typeReference: ESTree.TSTypeReference,
	aliases: ReadonlyMap<string, ESTree.TSTypeAliasDeclaration>,
	shadowedAliases: ReadonlySet<string>,
	visitedAliases: Set<string>,
	nextTypes: Array<ESTree.TSType>,
): void {
	if (typeReference.typeName.type !== "Identifier") return;
	const { name } = typeReference.typeName;
	if (name === "Promise" || name === "PromiseLike") {
		const value = typeReference.typeArguments?.params[0];
		if (value !== undefined) nextTypes.push(value);
		return;
	}

	if ((typeReference.typeArguments?.params.length ?? 0) > 0) return;
	if (shadowedAliases.has(name) || visitedAliases.has(name)) return;
	const alias = aliases.get(name);
	if (alias === undefined || alias.typeParameters) return;
	visitedAliases.add(name);
	nextTypes.push(alias.typeAnnotation);
}

function typeContainsUnknown(
	type: ESTree.TSType,
	aliases: ReadonlyMap<string, ESTree.TSTypeAliasDeclaration>,
	shadowedAliases: ReadonlySet<string>,
	visitedAliases: Set<string>,
	nextTypes: Array<ESTree.TSType>,
): boolean {
	if (type.type === "TSUnknownKeyword") return true;
	if (enqueueContainedTypes(type, nextTypes)) return false;
	if (type.type === "TSTypeReference") {
		enqueueTypeReference(type, aliases, shadowedAliases, visitedAliases, nextTypes);
	}
	return false;
}

function containsUnknown(
	type: ESTree.TSType,
	aliases: ReadonlyMap<string, ESTree.TSTypeAliasDeclaration>,
	shadowedAliases: ReadonlySet<string>,
): boolean {
	let pendingTypes = [type];
	let nextTypes: Array<ESTree.TSType> = [];
	const visitedAliases = new Set<string>();

	for (;;) {
		for (const current of pendingTypes) {
			if (typeContainsUnknown(current, aliases, shadowedAliases, visitedAliases, nextTypes)) return true;
		}

		if (nextTypes.length === 0) return false;
		const previousTypes = pendingTypes;
		pendingTypes = nextTypes;
		nextTypes = previousTypes;
		nextTypes.splice(0);
	}
}

const noUnknownReturns = createRule("no-unknown-returns", "anti-slop", {
	createOnce(context): Visitor {
		const aliases = new Map<string, ESTree.TSTypeAliasDeclaration>();

		function checkReturnType(node: FunctionWithReturnType): void {
			const annotation = node.returnType;
			if (!annotation) return;
			const shadowedAliases = lexicalTypeParameterNames(node, context.sourceCode.visitorKeys);
			if (!containsUnknown(annotation.typeAnnotation, aliases, shadowedAliases)) return;
			context.report({ messageId: "unknownReturn", node: annotation.typeAnnotation });
		}

		return {
			ArrowFunctionExpression: checkReturnType,
			FunctionDeclaration: checkReturnType,
			FunctionExpression: checkReturnType,
			Program(node): void {
				aliases.clear();
				for (const statement of node.body) {
					const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
					if (declaration?.type === "TSTypeAliasDeclaration") aliases.set(declaration.id.name, declaration);
				}
			},
			TSCallSignatureDeclaration: checkReturnType,
			TSConstructorType: checkReturnType,
			TSConstructSignatureDeclaration: checkReturnType,
			TSDeclareFunction: checkReturnType,
			TSEmptyBodyFunctionExpression: checkReturnType,
			TSFunctionType: checkReturnType,
			TSMethodSignature: checkReturnType,
		};
	},
	meta: {
		docs: {
			description: "Disallow functions whose explicit return contract is unknown or Promise<unknown>.",
			recommended: true,
		},
		messages: {
			unknownReturn:
				"This function exposes `unknown` to its caller. Parse the value at its boundary and return a named domain type.",
		},
		type: "problem",
	},
});

export default noUnknownReturns;
